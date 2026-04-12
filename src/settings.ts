import { App, PluginSettingTab, Setting } from 'obsidian';
import type CosmosPlugin from './main';

export interface CosmosSettings {
  supabaseUrl: string;
  supabaseAnonKey: string;
  systemName: string;
  syncFolder: string;   // '' means whole vault
  starName: string;     // default: 'default'
  passphraseHash: string; // auto-generated, meaningless (no content is sent)
}

export const DEFAULT_SETTINGS: CosmosSettings = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  systemName: '',
  syncFolder: '',
  starName: 'default',
  passphraseHash: '',
};

export class CosmosSettingTab extends PluginSettingTab {
  plugin: CosmosPlugin;

  constructor(app: App, plugin: CosmosPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Cosmos Sync' });
    containerEl.createEl('p', {
      text: 'Only orbital metadata leaves your machine. Content is never sent.',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('System name')
      .setDesc('The name of your solar system in Cosmos')
      .addText(text => text
        .setPlaceholder('my-vault')
        .setValue(this.plugin.settings.systemName)
        .onChange(async (value) => {
          this.plugin.settings.systemName = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Star name')
      .setDesc('Name of the star (use different names to group entries)')
      .addText(text => text
        .setPlaceholder('default')
        .setValue(this.plugin.settings.starName)
        .onChange(async (value) => {
          this.plugin.settings.starName = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Sync folder')
      .setDesc('Folder to sync (leave blank for entire vault)')
      .addText(text => text
        .setPlaceholder('')
        .setValue(this.plugin.settings.syncFolder)
        .onChange(async (value) => {
          this.plugin.settings.syncFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Supabase URL')
      .setDesc('Your Supabase project URL')
      .addText(text => text
        .setPlaceholder('https://xxx.supabase.co')
        .setValue(this.plugin.settings.supabaseUrl)
        .onChange(async (value) => {
          this.plugin.settings.supabaseUrl = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Supabase anon key')
      .setDesc('Your Supabase anonymous/public key')
      .addText(text => text
        .setPlaceholder('eyJ...')
        .setValue(this.plugin.settings.supabaseAnonKey)
        .onChange(async (value) => {
          this.plugin.settings.supabaseAnonKey = value;
          await this.plugin.saveSettings();
        }));
  }
}
