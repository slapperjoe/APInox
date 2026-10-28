/**
 * Editor settings have one store: `config.ui`.
 *
 * They used to have two. The app-level `EditorSettingsProvider` persisted to
 * `localStorage`, while `RequestWorkspace` and `MonacoRequestEditorWithToolbar` each
 * owned a nested provider persisted to `config.ui` — so the notes gear and the proxy
 * editor could show one font size while the request editor showed another, and they
 * only agreed when both started from defaults.
 *
 * These tests pin the single store: the mapping round-trips, no component owns a
 * second provider, and nothing reads or writes the old localStorage key.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
    DEFAULT_EDITOR_SETTINGS,
    editorSettingsFromConfig,
    editorSettingsToUiConfig,
} from '../request-editor/core';

const SRC = resolve(__dirname, '..');              // src-tauri/webview/src
const WEBVIEW = resolve(SRC, '..');                // src-tauri/webview
const ROOT = resolve(WEBVIEW, '..', '..');         // repo root
const read = (pathFromRoot: string) => readFileSync(resolve(ROOT, pathFromRoot), 'utf8');

describe('the settings mapping round-trips', () => {
    it('config.ui → EditorSettings → config.ui returns the same values', () => {
        const settings = {
            inlineValues: false,
            alignAttributes: true,
            hideCausality: true,
            showLineNumbers: false,
            showMinimap: true,
            fontSize: 18,
            fontFamily: 'JetBrains Mono',
            prettyPrint: false,
        };

        expect(editorSettingsFromConfig(editorSettingsToUiConfig(settings))).toEqual(settings);
    });

    it('an empty config falls back to the defaults rather than undefined', () => {
        expect(editorSettingsFromConfig(undefined)).toEqual(DEFAULT_EDITOR_SETTINGS);
    });

    it('the backend defaults match the frontend defaults', () => {
        // `settings_manager.rs` builds the default `UiConfig` explicitly. If the two
        // drift, a fresh install shows different values depending on which path reads
        // them.
        const rust = read('src-tauri/src/settings_manager.rs');
        expect(rust).toContain('show_minimap: Some(false)');
        expect(rust).toContain('pretty_print: Some(true)');
        expect(rust).toContain('hide_causality_data: Some(false)');
    });
});

describe('the store is single', () => {
    it('no component owns a second EditorSettingsProvider', () => {
        for (const file of [
            'src-tauri/webview/src/request-editor/components/RequestWorkspace.tsx',
            'src-tauri/webview/src/request-editor/components/MonacoRequestEditorWithToolbar.tsx',
        ]) {
            const src = read(file);
            expect(src, `${file} still owns a provider`).not.toContain('EditorSettingsProvider');
        }
    });

    it('the app-level provider is backed by config.ui, not localStorage', () => {
        const app = read('src-tauri/webview/src/App.tsx');
        expect(app).toContain('editorSettingsFromConfig(config?.ui)');
        expect(app).toContain("command: 'saveUiState'");
        expect(app).not.toContain('apinox-editor-settings');
    });

    it('the old localStorage key is gone from the whole webview', () => {
        const offenders = ['src-tauri/webview/src/App.tsx'];
        for (const file of offenders) {
            expect(read(file)).not.toContain('EDITOR_SETTINGS_KEY');
        }
    });

    it('the message handler pushes external config changes into the store', () => {
        // The provider is seeded once, so a change made by the Settings panel or the
        // JSON editor only reaches the editors if the handler applies it.
        const handler = read('src-tauri/webview/src/hooks/useMessageHandler.ts');
        expect(handler).toContain('setEditorSettings(editorSettingsFromConfig(message.config.ui))');
    });
});
