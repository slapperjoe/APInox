import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, Facet } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { convertFileSrc } from "@tauri-apps/api/core";

// Facet to pass the base directory for resolving relative image paths
export const baseDirFacet = Facet.define<string, string>({
    combine: values => values[0] || ""
});

// --- Widgets ---

class HiddenWidget extends WidgetType {
    toDOM() {
        const span = document.createElement("span");
        span.style.display = "none";
        return span;
    }
}

class BulletWidget extends WidgetType {
    toDOM() {
        const span = document.createElement("span");
        span.className = "cm-bullet";
        span.textContent = "•";
        return span;
    }
}

class HRWidget extends WidgetType {
    toDOM() {
        const hr = document.createElement("hr");
        hr.className = "cm-hr";
        return hr;
    }
}

class ImageWidget extends WidgetType {
    constructor(readonly url: string, readonly alt: string, readonly baseDir: string) {
        super();
    }

    eq(other: ImageWidget) {
        return other.url === this.url && other.alt === this.alt && other.baseDir === this.baseDir;
    }

    toDOM() {
        const img = document.createElement("img");

        // Check if URL is absolute (http/https/data) or relative
        let resolvedUrl = this.url;
        if (this.baseDir && !this.url.match(/^(https?:|data:|file:|\/)/i)) {
            // It's a relative path - resolve it against the base directory
            const absolutePath = this.baseDir.replace(/\\/g, '/') + '/' + this.url;
            resolvedUrl = convertFileSrc(absolutePath);
        } else if (this.url.startsWith('/') || this.url.match(/^[a-zA-Z]:/)) {
            // Absolute local path
            resolvedUrl = convertFileSrc(this.url);
        }

        img.src = resolvedUrl;
        img.alt = this.alt;
        img.className = "cm-image";
        img.title = this.alt;
        return img;
    }
}

class TableWidget extends WidgetType {
    constructor(readonly rawContent: string) {
        super();
    }

    eq(other: TableWidget) {
        return other.rawContent === this.rawContent;
    }

    toDOM() {
        const div = document.createElement("div");
        div.className = "cm-table-widget";

        const lines = this.rawContent.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) {
            div.textContent = "[Invalid Table]";
            return div;
        }

        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const tbody = document.createElement("tbody");

        const normalizeRow = (line: string) => {
            return line.split('|').map(c => c.trim()).filter((c, i, arr) => {
                if (i === 0 && c === '') return false;
                if (i === arr.length - 1 && c === '') return false;
                return true;
            });
        }

        const headers = normalizeRow(lines[0]);
        const headerRow = document.createElement("tr");
        headers.forEach(h => {
            const th = document.createElement("th");
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        for (let i = 2; i < lines.length; i++) {
            const cells = normalizeRow(lines[i]);
            const tr = document.createElement("tr");
            cells.forEach(c => {
                const td = document.createElement("td");
                td.textContent = c;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        div.appendChild(table);
        return div;
    }
}

// Helper to collect decorations before building
interface DecoSpec {
    from: number;
    to: number;
    deco: Decoration;
}

function hybridDecorations(view: EditorView) {
    const specs: DecoSpec[] = [];

    const selection = view.state.selection.main;
    const activeLineObj = view.state.doc.lineAt(selection.head);
    const activeLineStart = activeLineObj.from;
    const activeLineEnd = activeLineObj.to;

    const hiddenMarkTypes = [
        "EmphasisMark",
        "StrongEmphasisMark",
        "BlockquoteMark",
        "CodeMark",
        "LinkMark",
    ];

    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter: (node) => {
                const isCursorInside = (node.from <= activeLineEnd && node.to >= activeLineStart);

                // Blocks
                if (node.name === "Table") {
                    if (!isCursorInside) {
                        specs.push({
                            from: node.from,
                            to: node.to,
                            deco: Decoration.replace({
                                widget: new TableWidget(view.state.sliceDoc(node.from, node.to))
                            })
                        });
                        return false;
                    }
                }

                if (node.name === "HorizontalRule") {
                    if (!isCursorInside) {
                        specs.push({
                            from: node.from,
                            to: node.to,
                            deco: Decoration.replace({ widget: new HRWidget() })
                        });
                        return false;
                    }
                }

                // Inline intersection check
                if (Math.max(node.from, activeLineStart) <= Math.min(node.to, activeLineEnd)) {
                    return;
                }

                // Headers
                if (node.name === "HeaderMark") {
                    specs.push({
                        from: node.from,
                        to: node.to,
                        deco: Decoration.replace({ widget: new HiddenWidget() })
                    });
                    return;
                }
                if (node.name.startsWith("ATXHeading")) {
                    const level = node.name.replace("ATXHeading", "");
                    specs.push({
                        from: node.from,
                        to: node.to,
                        deco: Decoration.mark({ class: `cm-header-rendered-${level}` })
                    });
                    return;
                }

                // Lists
                if (node.name === "ListMark") {
                    specs.push({
                        from: node.from,
                        to: node.to,
                        deco: Decoration.replace({ widget: new BulletWidget() })
                    });
                    return;
                }

                // Images
                if (node.name === "Image") {
                    const raw = view.state.sliceDoc(node.from, node.to);
                    const match = raw.match(/!\[(.*?)\]\((.*?)\)/);
                    if (match) {
                        const alt = match[1];
                        const url = match[2];
                        const baseDir = view.state.facet(baseDirFacet);
                        specs.push({
                            from: node.from,
                            to: node.to,
                            deco: Decoration.replace({ widget: new ImageWidget(url, alt, baseDir) })
                        });
                        return false;
                    }
                }

                // Other marks
                if (hiddenMarkTypes.includes(node.name)) {
                    specs.push({
                        from: node.from,
                        to: node.to,
                        deco: Decoration.replace({ widget: new HiddenWidget() })
                    });
                }
            }
        });
    }

    // SORT the decorations to keep RangeSetBuilder happy.
    // Sort by 'from' ascending, then 'to' ascending?
    // CodeMirror: "Ranges must be added in sorted order (by start position, then end position)"
    // Does it mean 0-1 comes *before* 0-10?
    // "If two ranges start at the same position, the one that ends earlier should come first."
    specs.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from;
        return a.to - b.to;
    });

    const builder = new RangeSetBuilder<Decoration>();
    for (const s of specs) {
        builder.add(s.from, s.to, s.deco);
    }

    return builder.finish();
}

export const hybridPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = hybridDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = hybridDecorations(update.view);
        }
    }
}, {
    decorations: v => v.decorations
});
