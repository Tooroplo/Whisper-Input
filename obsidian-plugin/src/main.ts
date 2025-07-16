import { Plugin, PluginSettingTab, App, Setting, Notice } from 'obsidian';

interface VoiceInputSettings {
  baseUrl: string;
  apiKey: string;
  systemPrompt: string;
  maxDuration: number;
}

const DEFAULT_SETTINGS: VoiceInputSettings = {
  baseUrl: '',
  apiKey: '',
  systemPrompt: 'You are a helpful assistant.',
  maxDuration: 15
};

export default class VoiceInputPlugin extends Plugin {
  settings: VoiceInputSettings;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'start-voice-input',
      name: 'Start Voice Input',
      callback: () => this.startRecording()
    });

    this.addSettingTab(new VoiceInputSettingTab(this.app, this));
  }

  onunload() {
    // nothing
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      const timeout = setTimeout(() => recorder.stop(), this.settings.maxDuration * 1000);

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        clearTimeout(timeout);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        await this.sendAudio(buffer);
      };

      recorder.start();
      new Notice('Recording...');
    } catch (e) {
      new Notice('Failed to access microphone');
    }
  }

  async sendAudio(buffer: ArrayBuffer) {
    try {
      const resp = await fetch(this.settings.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/octet-stream',
          'X-System-Prompt': this.settings.systemPrompt
        },
        body: buffer
      });
      if (!resp.ok) throw new Error('Request failed');
      const data = await resp.json();
      const editor = this.app.workspace.activeEditor;
      if (editor) {
        editor.replaceSelection(data.text + '\n');
      }
    } catch (err) {
      new Notice('Transcription failed');
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class VoiceInputSettingTab extends PluginSettingTab {
  plugin: VoiceInputPlugin;

  constructor(app: App, plugin: VoiceInputPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('API Base URL')
      .addText(text => text
        .setPlaceholder('https://api.example.com')
        .setValue(this.plugin.settings.baseUrl)
        .onChange(async (value) => {
          this.plugin.settings.baseUrl = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('API Key')
      .addText(text => text
        .setPlaceholder('secret')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('System Prompt')
      .addTextArea(area => area
        .setValue(this.plugin.settings.systemPrompt)
        .onChange(async value => {
          this.plugin.settings.systemPrompt = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Max Recording Seconds')
      .addSlider(slider => slider
        .setLimits(5, 60, 1)
        .setValue(this.plugin.settings.maxDuration)
        .onChange(async value => {
          this.plugin.settings.maxDuration = value;
          await this.plugin.saveSettings();
        }));
  }
}
