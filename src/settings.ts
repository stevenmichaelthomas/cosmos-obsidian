import { App, PluginSettingTab, Setting } from 'obsidian';
import type CosmosPlugin from './main';

export const SUPABASE_URL = 'https://gzhdsgkjwxjuelsvksde.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aGRzZ2tqd3hqdWVsc3Zrc2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjAzNzYsImV4cCI6MjA4OTczNjM3Nn0.D1B9zbnAynYDkydGVHMSuEP-rzwHoDh5812YLUrWizg';

export interface CosmosSettings {
  systemName: string;
  syncFolder: string;   // '' means whole vault
  starName: string;     // default: 'default'
  passphraseHash: string; // auto-generated, meaningless (no content is sent)
  systemSecret: string; // per-system secret for keyed SHA-256 orbital hashing (auto-generated)
}

export const DEFAULT_SETTINGS: CosmosSettings = {
  systemName: '',
  syncFolder: '',
  starName: 'default',
  passphraseHash: '',
  systemSecret: '',
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

  }
}
