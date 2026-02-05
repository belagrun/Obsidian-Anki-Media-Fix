import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, FileSystemAdapter, Modal } from 'obsidian';

const ANKI_PORT = 8765;

interface AnkiMediaFixSettings {
    mediaFolder: string;
    batchSize: number;
}

const DEFAULT_SETTINGS: AnkiMediaFixSettings = {
    mediaFolder: '',
    batchSize: 50
}

interface AnkiConnectResponse<T> {
    result: T;
    error: string | null;
}

interface AnkiNote {
    noteId: number;
    modelName: string;
    fields: Record<string, { value: string; order: number }>;
    tags: string[];
}

export default class AnkiMediaFixPlugin extends Plugin {
    settings: AnkiMediaFixSettings;

    async onload() {
        await this.loadSettings();

        // Comando para sincronizar todas as mídias
        this.addCommand({
            id: 'sync-all-media',
            name: 'Sync all media to Anki (force)',
            callback: () => this.syncAllMedia()
        });

        // Comando para sincronizar apenas mídias faltantes
        this.addCommand({
            id: 'sync-missing-media',
            name: 'Sync only missing media to Anki',
            callback: () => this.syncMissingMedia()
        });

        // Comando para listar mídias faltantes
        this.addCommand({
            id: 'list-missing-media',
            name: 'List missing media in Anki',
            callback: () => this.listMissingMedia()
        });

        this.addSettingTab(new AnkiMediaFixSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Invocar API do AnkiConnect
    async invokeAnkiConnect<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.addEventListener('error', () => reject(new Error('Failed to connect to Anki. Is Anki running with AnkiConnect?')));
            xhr.addEventListener('load', () => {
                try {
                    const response: AnkiConnectResponse<T> = JSON.parse(xhr.responseText);
                    if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response.result);
                    }
                } catch (e) {
                    reject(e instanceof Error ? e : new Error(String(e)));
                }
            });
            xhr.open('POST', `http://127.0.0.1:${ANKI_PORT}`);
            xhr.send(JSON.stringify({ action, version: 6, params }));
        });
    }

    // Buscar todas as notas do Anki
    async getAllAnkiNotes(): Promise<AnkiNote[]> {
        // Buscar todos os IDs de notas
        const noteIds = await this.invokeAnkiConnect<number[]>('findNotes', { query: '*' });

        if (noteIds.length === 0) {
            return [];
        }

        // Buscar informações das notas em lotes
        const notes: AnkiNote[] = [];
        const batchSize = this.settings.batchSize;

        for (let i = 0; i < noteIds.length; i += batchSize) {
            const batch = noteIds.slice(i, i + batchSize);
            const batchNotes = await this.invokeAnkiConnect<AnkiNote[]>('notesInfo', { notes: batch });
            notes.push(...batchNotes);
        }

        return notes;
    }

    // Extrair nomes de arquivos de mídia dos campos das notas
    extractMediaFromNotes(notes: AnkiNote[]): Set<string> {
        const mediaFiles = new Set<string>();

        // Regex para encontrar imagens e áudio
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        const soundRegex = /\[sound:([^\]]+)\]/gi;
        // Também pegar imagens em formato markdown que possam ter sido convertidas
        const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/gi;

        for (const note of notes) {
            for (const fieldName in note.fields) {
                const fieldValue = note.fields[fieldName].value;

                // Imagens HTML
                let match;
                while ((match = imgRegex.exec(fieldValue)) !== null) {
                    const filename = this.extractFilename(match[1]);
                    if (filename && !this.isUrl(match[1])) {
                        mediaFiles.add(decodeURIComponent(filename));
                    }
                }
                imgRegex.lastIndex = 0;

                // Áudio
                while ((match = soundRegex.exec(fieldValue)) !== null) {
                    const filename = this.extractFilename(match[1]);
                    if (filename) {
                        mediaFiles.add(decodeURIComponent(filename));
                    }
                }
                soundRegex.lastIndex = 0;

                // Imagens Markdown
                while ((match = mdImgRegex.exec(fieldValue)) !== null) {
                    const filename = this.extractFilename(match[1]);
                    if (filename && !this.isUrl(match[1])) {
                        mediaFiles.add(decodeURIComponent(filename));
                    }
                }
                mdImgRegex.lastIndex = 0;
            }
        }

        return mediaFiles;
    }

    extractFilename(path: string): string {
        // Remover parâmetros de URL se existirem
        const cleanPath = path.split('?')[0];
        // Extrair apenas o nome do arquivo
        const parts = cleanPath.split(/[/\\]/);
        return parts[parts.length - 1];
    }

    isUrl(path: string): boolean {
        return path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:');
    }

    // Buscar lista de arquivos de mídia no Anki
    async getAnkiMediaFiles(): Promise<string[]> {
        return await this.invokeAnkiConnect<string[]>('getMediaFilesNames', { pattern: '*' });
    }

    // Encontrar arquivos no Obsidian vault
    findFileInVault(filename: string): TFile | null {
        const files = this.app.vault.getFiles();

        // Buscar pelo nome exato primeiro
        for (const file of files) {
            if (file.name === filename) {
                return file;
            }
        }

        // Buscar em subpastas de mídia comuns
        const mediaFolders = ['attachments', 'assets', 'media', 'images', 'Anexos', 'Mídia'];
        if (this.settings.mediaFolder) {
            mediaFolders.unshift(this.settings.mediaFolder);
        }

        for (const folder of mediaFolders) {
            const path = `${folder}/${filename}`;
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                return file;
            }
        }

        return null;
    }

    // Enviar arquivo de mídia para o Anki
    async sendMediaToAnki(filename: string, filePath: string): Promise<boolean> {
        try {
            await this.invokeAnkiConnect('storeMediaFile', {
                filename: filename,
                path: filePath,
                deleteExisting: true
            });
            return true;
        } catch (e) {
            console.error(`Failed to send ${filename}: ${e}`);
            return false;
        }
    }

    // Sincronizar todas as mídias (força reenvio)
    async syncAllMedia() {
        const notice = new Notice('Scanning Anki notes for media...', 0);

        try {
            // 1. Buscar todas as notas do Anki
            const notes = await this.getAllAnkiNotes();
            notice.setMessage(`Found ${notes.length} notes. Extracting media references...`);

            // 2. Extrair referências de mídia
            const mediaRefs = this.extractMediaFromNotes(notes);
            notice.setMessage(`Found ${mediaRefs.size} media references. Searching in vault...`);

            // 3. Encontrar e enviar arquivos
            let sent = 0;
            let notFound = 0;
            const notFoundFiles: string[] = [];

            const adapter = this.app.vault.adapter as FileSystemAdapter;

            for (const filename of mediaRefs) {
                const file = this.findFileInVault(filename);
                if (file) {
                    const fullPath = adapter.getFullPath(file.path);
                    const success = await this.sendMediaToAnki(filename, fullPath);
                    if (success) {
                        sent++;
                        notice.setMessage(`Sent ${sent}/${mediaRefs.size} files...`);
                    }
                } else {
                    notFound++;
                    notFoundFiles.push(filename);
                }
            }

            notice.hide();

            if (notFoundFiles.length > 0) {
                new ResultModal(this.app, sent, notFound, notFoundFiles).open();
            } else {
                new Notice(`✅ Sync complete! Sent ${sent} files to Anki.`);
            }

        } catch (e) {
            notice.hide();
            new Notice(`❌ Error: ${e}`);
        }
    }

    // Sincronizar apenas mídias faltantes
    async syncMissingMedia() {
        const notice = new Notice('Scanning Anki for missing media...', 0);

        try {
            // 1. Buscar todas as notas do Anki
            const notes = await this.getAllAnkiNotes();
            notice.setMessage(`Found ${notes.length} notes. Extracting media references...`);

            // 2. Extrair referências de mídia
            const mediaRefs = this.extractMediaFromNotes(notes);
            notice.setMessage(`Found ${mediaRefs.size} media references. Checking existing files...`);

            // 3. Buscar arquivos existentes no Anki
            const existingMedia = new Set(await this.getAnkiMediaFiles());

            // 4. Filtrar apenas os faltantes
            const missingMedia = new Set<string>();
            for (const media of mediaRefs) {
                if (!existingMedia.has(media)) {
                    missingMedia.add(media);
                }
            }

            notice.setMessage(`Found ${missingMedia.size} missing files. Sending to Anki...`);

            // 5. Encontrar e enviar arquivos faltantes
            let sent = 0;
            let notFound = 0;
            const notFoundFiles: string[] = [];

            const adapter = this.app.vault.adapter as FileSystemAdapter;

            for (const filename of missingMedia) {
                const file = this.findFileInVault(filename);
                if (file) {
                    const fullPath = adapter.getFullPath(file.path);
                    const success = await this.sendMediaToAnki(filename, fullPath);
                    if (success) {
                        sent++;
                        notice.setMessage(`Sent ${sent}/${missingMedia.size} missing files...`);
                    }
                } else {
                    notFound++;
                    notFoundFiles.push(filename);
                }
            }

            notice.hide();

            if (notFoundFiles.length > 0) {
                new ResultModal(this.app, sent, notFound, notFoundFiles).open();
            } else if (missingMedia.size === 0) {
                new Notice('No missing media found.');
            } else {
                new Notice(`✅ Sync complete! Sent ${sent} missing files to Anki.`);
            }

        } catch (e) {
            notice.hide();
            new Notice(`❌ Error: ${e}`);
        }
    }

    // Listar mídias faltantes
    async listMissingMedia() {
        const notice = new Notice('Scanning Anki for missing media...', 0);

        try {
            // 1. Buscar todas as notas do Anki
            const notes = await this.getAllAnkiNotes();
            notice.setMessage(`Found ${notes.length} notes. Extracting media references...`);

            // 2. Extrair referências de mídia
            const mediaRefs = this.extractMediaFromNotes(notes);

            // 3. Buscar arquivos existentes no Anki
            const existingMedia = new Set(await this.getAnkiMediaFiles());

            // 4. Filtrar apenas os faltantes
            const missingMedia: string[] = [];
            for (const media of mediaRefs) {
                if (!existingMedia.has(media)) {
                    missingMedia.push(media);
                }
            }

            notice.hide();

            // 5. Mostrar resultado
            new MissingMediaModal(this.app, missingMedia, this).open();

        } catch (e) {
            notice.hide();
            new Notice(`❌ Error: ${e}`);
        }
    }
}

class ResultModal extends Modal {
    sent: number;
    notFound: number;
    notFoundFiles: string[];

    constructor(app: App, sent: number, notFound: number, notFoundFiles: string[]) {
        super(app);
        this.sent = sent;
        this.notFound = notFound;
        this.notFoundFiles = notFoundFiles;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        new Setting(contentEl).setName('Sync results').setHeading();
        contentEl.createEl('p', { text: `✅ Sent: ${this.sent} files` });
        contentEl.createEl('p', { text: `⚠️ Not found in vault: ${this.notFound} files` });

        if (this.notFoundFiles.length > 0) {
            new Setting(contentEl).setName('Files not found').setHeading();
            const list = contentEl.createEl('div', { cls: 'anki-media-fix-list anki-media-fix-list--small' });

            for (const file of this.notFoundFiles.slice(0, 100)) {
                list.createEl('div', { text: file });
            }

            if (this.notFoundFiles.length > 100) {
                list.createEl('div', { text: `... and ${this.notFoundFiles.length - 100} more` });
            }
        }

        const buttonDiv = contentEl.createEl('div', { cls: 'anki-media-fix-buttons anki-media-fix-buttons--right' });

        const closeBtn = buttonDiv.createEl('button', { text: 'Close' });
        closeBtn.addEventListener('click', () => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class MissingMediaModal extends Modal {
    missingMedia: string[];
    plugin: AnkiMediaFixPlugin;

    constructor(app: App, missingMedia: string[], plugin: AnkiMediaFixPlugin) {
        super(app);
        this.missingMedia = missingMedia;
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        new Setting(contentEl).setName('Missing media in Anki').setHeading();
        contentEl.createEl('p', { text: `Found ${this.missingMedia.length} missing files` });

        if (this.missingMedia.length > 0) {
            const list = contentEl.createEl('div', { cls: 'anki-media-fix-list anki-media-fix-list--large' });

            for (const file of this.missingMedia.slice(0, 200)) {
                list.createEl('div', { text: file });
            }

            if (this.missingMedia.length > 200) {
                list.createEl('div', { text: `... and ${this.missingMedia.length - 200} more` });
            }
        }

        const buttonDiv = contentEl.createEl('div', { cls: 'anki-media-fix-buttons anki-media-fix-buttons--row' });

        if (this.missingMedia.length > 0) {
            const syncBtn = buttonDiv.createEl('button', { text: 'Sync missing files', cls: 'anki-media-fix-button-primary' });
            syncBtn.addEventListener('click', () => {
                this.close();
                void this.plugin.syncMissingMedia();
            });
        }

        const closeBtn = buttonDiv.createEl('button', { text: 'Close' });
        closeBtn.addEventListener('click', () => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class AnkiMediaFixSettingTab extends PluginSettingTab {
    plugin: AnkiMediaFixPlugin;

    constructor(app: App, plugin: AnkiMediaFixPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Media folder')
            .setDesc('Primary folder where your media files are stored (e.g., "attachments", "assets"). Leave empty to search entire vault.')
            .addText(text => text
                .setPlaceholder('Attachments')
                .setValue(this.plugin.settings.mediaFolder)
                .onChange(async (value) => {
                    this.plugin.settings.mediaFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Batch size')
            .setDesc('Number of notes to process at once when querying Anki (lower = slower but more stable)')
            .addText(text => text
                .setPlaceholder('50')
                .setValue(String(this.plugin.settings.batchSize))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.batchSize = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl).setName('How to use').setHeading();
        const instructions = containerEl.createEl('ol');
        instructions.createEl('li', { text: 'Make sure Anki is running with the ankiconnect add-on installed.' });
        const commandItem = instructions.createEl('li');
        commandItem.appendText('Use ');
        commandItem.createEl('strong', { text: 'Ctrl/Cmd + P' });
        commandItem.appendText(' to open command palette');
        instructions.createEl('li', { text: 'Search for "Anki media fix".' });
        const listItem = instructions.createEl('li');
        listItem.appendText('Choose one of the commands:');
        const commandList = listItem.createEl('ul');
        const allMedia = commandList.createEl('li');
        allMedia.createEl('strong', { text: 'Sync all media' });
        allMedia.appendText(': Resends all media files referenced in your Anki notes');
        const missingMedia = commandList.createEl('li');
        missingMedia.createEl('strong', { text: 'Sync only missing media' });
        missingMedia.appendText(': Sends only files that are missing in Anki');
        const listMissing = commandList.createEl('li');
        listMissing.createEl('strong', { text: 'List missing media' });
        listMissing.appendText(': Shows which files are missing');
    }
}
