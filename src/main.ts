import { Plugin, Modal, Notice, Setting } from 'obsidian';
import { createClient } from '@supabase/supabase-js';
import { CosmosSettings, CosmosSettingTab, DEFAULT_SETTINGS, SUPABASE_URL, SUPABASE_ANON_KEY } from './settings';
import { syncVault, computeOwnerHash } from './sync';

export default class CosmosPlugin extends Plugin {
  settings: CosmosSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new CosmosSettingTab(this.app, this));

    this.addCommand({
      id: 'sync-vault',
      name: 'Sync vault',
      callback: async () => {
        await syncVault(this.app.vault, this.settings);
        // Persist settings in case passphraseHash was generated
        await this.saveSettings();
      },
    });

    this.addCommand({
      id: 'delete-system',
      name: 'Delete system',
      callback: () => {
        new DeleteSystemModal(this.app, this).open();
      },
    });

    this.addRibbonIcon('orbit', 'Sync vault', async () => {
      await syncVault(this.app.vault, this.settings);
      await this.saveSettings();
    });
  }

  onunload() {
    // nothing to clean up
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<CosmosSettings>);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// ── Delete confirmation modal ─────────────────────────────────

class DeleteSystemModal extends Modal {
  plugin: CosmosPlugin;

  constructor(app: import('obsidian').App, plugin: CosmosPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    const slug = this.plugin.settings.systemSlug;

    if (!slug) {
      contentEl.createEl('p', { text: 'No system has been synced yet. Nothing to delete.' });
      return;
    }

    new Setting(contentEl).setName('Delete system').setHeading();
    contentEl.createEl('p', {
      text: `This will permanently delete the solar system "${slug}" and all its stars and entries. This cannot be undone.`,
    });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    btnRow.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close());

    const deleteBtn = btnRow.createEl('button', { text: 'Delete', cls: 'mod-warning' });
    deleteBtn.addEventListener('click', () => {
      void this.handleDelete(slug, deleteBtn).catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        new Notice(`Delete failed: ${msg}`, 8000);
      });
    });
  }

  async handleDelete(slug: string, deleteBtn: HTMLButtonElement) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    const ownerHash = await computeOwnerHash(this.plugin.settings.systemSecret);
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await client.rpc<boolean>('delete_system', {
      p_slug: slug,
      p_owner_secret_hash: ownerHash,
    });

    if (error) {
      new Notice(`Delete failed: ${error.message}`, 8000);
    } else if (data === true) {
      this.plugin.settings.systemSlug = '';
      this.plugin.settings.starName = '';
      this.plugin.settings.passphraseHash = '';
      this.plugin.settings.systemSecret = '';
      await this.plugin.saveSettings();
      new Notice(`System "${slug}" deleted. You can create a new one by syncing.`, 5000);
    } else {
      new Notice('Delete failed: owner secret did not match.', 8000);
    }

    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
