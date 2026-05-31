import { App, Modal, PluginSettingTab, Setting, Notice } from 'obsidian';
import { createClient } from '@supabase/supabase-js';
import type CosmosPlugin from './main';
import { computeOwnerHash } from './sync';

export const SUPABASE_URL = 'https://gzhdsgkjwxjuelsvksde.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aGRzZ2tqd3hqdWVsc3Zrc2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjAzNzYsImV4cCI6MjA4OTczNjM3Nn0.D1B9zbnAynYDkydGVHMSuEP-rzwHoDh5812YLUrWizg';

export interface CosmosSettings {
  systemName: string;
  syncFolder: string;   // '' means whole vault
  starName: string;     // default: 'default'
  passphraseHash: string; // auto-generated, meaningless (no content is sent)
  systemSecret: string; // per-system secret for keyed SHA-256 orbital hashing (auto-generated)
  systemSlug: string;   // persisted after first sync — prevents rename from creating a new system
}

export const DEFAULT_SETTINGS: CosmosSettings = {
  systemName: '',
  syncFolder: '',
  starName: '',
  passphraseHash: '',
  systemSecret: '',
  systemSlug: '',
};

export const COSMOS_BASE_URL = 'https://cosmos.supermagicapps.com';

export class CosmosSettingTab extends PluginSettingTab {
  plugin: CosmosPlugin;

  constructor(app: App, plugin: CosmosPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('p', {
      text: 'Only orbital metadata leaves your machine. Content is never sent.',
      cls: 'setting-item-description',
    });

    const slugLocked = !!this.plugin.settings.systemSlug;
    const systemNameSetting = new Setting(containerEl)
      .setName('System name');

    if (slugLocked) {
      systemNameSetting
        .setDesc(`Locked to slug: ${this.plugin.settings.systemSlug}`)
        .addText(text => text
          .setValue(this.plugin.settings.systemName)
          .setDisabled(true));
    } else {
      systemNameSetting
        .setDesc('The name of your solar system')
        .addText(text => text
          .setPlaceholder('My vault')
          .setValue(this.plugin.settings.systemName)
          .onChange(async (value) => {
            this.plugin.settings.systemName = value;
            await this.plugin.saveSettings();
          }));
    }

    if (slugLocked) {
      const linkEl = containerEl.createDiv({ cls: 'cosmos-galaxy-link' });
      linkEl.createEl('a', {
        text: `View your galaxy →`,
        href: `${COSMOS_BASE_URL}/s/${this.plugin.settings.systemSlug}`,
      });

      new Setting(containerEl)
        .setName('Delete system')
        .setDesc('Permanently delete this solar system')
        .addButton(btn => btn
          .setButtonText('Delete')
          .setWarning()
          .onClick(() => {
            new ConfirmDeleteModal(this.app, this.plugin, () => this.display()).open();
          }));
    }

    new Setting(containerEl)
      .setName('Star name')
      .setDesc('Name of the star (leave blank to auto-assign)')
      .addText(text => text
        .setPlaceholder('Sol 1')
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

class ConfirmDeleteModal extends Modal {
  plugin: CosmosPlugin;
  onDeleted: () => void;

  constructor(app: App, plugin: CosmosPlugin, onDeleted: () => void) {
    super(app);
    this.plugin = plugin;
    this.onDeleted = onDeleted;
  }

  onOpen() {
    const { contentEl } = this;
    const slug = this.plugin.settings.systemSlug;

    contentEl.createEl('h3', { text: 'Delete system' });
    contentEl.createEl('p', {
      text: `This will permanently delete "${slug}" and all its stars and entries. This cannot be undone.`,
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
      this.onDeleted();
    } else {
      new Notice('Delete failed: owner secret did not match.', 8000);
    }

    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
