import { Plugin } from 'obsidian';
import { CosmosSettings, CosmosSettingTab, DEFAULT_SETTINGS } from './settings';
import { syncVault } from './sync';

export default class CosmosPlugin extends Plugin {
  settings: CosmosSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new CosmosSettingTab(this.app, this));

    this.addCommand({
      id: 'sync-vault',
      name: 'Sync vault to Cosmos',
      callback: async () => {
        await syncVault(this.app.vault, this.settings);
        // Persist settings in case passphraseHash was generated
        await this.saveSettings();
      },
    });

    this.addRibbonIcon('orbit', 'Sync vault to Cosmos', async () => {
      await syncVault(this.app.vault, this.settings);
      await this.saveSettings();
    });
  }

  onunload() {
    // nothing to clean up
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
