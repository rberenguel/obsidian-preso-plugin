// main.ts

import {
	App,
	Plugin,
	WorkspaceLeaf,
	MarkdownView,
	Notice,
	TFile,
} from "obsidian";
import { SlidePreviewView } from "./SlidePreviewView";
import { SlidesModal } from "./SlidesModal";
import { getSlidesWithBoundaries, Slide } from "./Parser";
import { Exporter } from "./Exporter";

export default class SlidesPlugin extends Plugin {
	private previewViews: Map<string, SlidePreviewView> = new Map();
	private exporter: Exporter;

	async onload() {
		this.exporter = new Exporter(this.app);

		this.addCommand({
      id: "toggle-slide-preview",
      name: "Toggle slide preview",
      icon: "projector",
      callback: () => {
        const leaf = this.app.workspace.activeLeaf;
        if (leaf?.view instanceof MarkdownView) {
            this.togglePreview(leaf);
        }
      },
    });

		this.addCommand({
			id: "export-presentation-as-html",
			name: "Export presentation as HTML (with JS)",
			icon: "download",
			callback: () => {
				this.exporter.exportPresentationAsHtml(false);
			},
		});

		this.addCommand({
			id: "export-presentation-as-html-css-only",
			name: "Export presentation as HTML (CSS only)",
			icon: "file-code",
			callback: () => {
				this.exporter.exportPresentationAsHtml(true);
			},
		});

		this.addCommand({
			id: "show-full-slideset",
			name: "Show full slideset in modal",
			callback: () => {
				const activeView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView?.file) {
					const file = activeView.file;
					const fileCache = this.app.metadataCache.getFileCache(file);
					const theme = fileCache?.frontmatter?.preso;

					this.app.vault.read(file).then((content) => {
						const allSlides = getSlidesWithBoundaries(content);
						new SlidesModal(
							this.app,
							allSlides,
							file.path,
							typeof theme === "string" ? theme : null,
						).open();
					});
				}
			},
		});

		this.app.workspace.on(
			"active-leaf-change",
			this.handleActiveLeafChange.bind(this),
		);
		this.app.workspace.on(
			"layout-change",
			this.handleLayoutChange.bind(this),
		);
	}

private togglePreview(leaf: WorkspaceLeaf) {
    if (leaf?.view instanceof MarkdownView) {
      // Check if a preview exists for this file path before trying to toggle
      if (this.previewViews.has(leaf.view.file?.path || "nope")) {
        this.previewViews.get(leaf.view.file?.path || "nope")?.toggle();
      } else {
        // If no preview exists, create one
        this.activateSlides(leaf);
      }
    }
  }

	onunload() {
		this.previewViews.forEach((view) => view.destroy());
		this.previewViews.clear();
	}

	handleLayoutChange() {
		const leafPaths = new Set(
			this.app.workspace.getLeavesOfType("markdown").map((leaf) => {
				const view = leaf.view as MarkdownView;
				return view.file?.path ?? "";
			}),
		);

		for (const path of this.previewViews.keys()) {
			if (!leafPaths.has(path)) {
				this.previewViews.get(path)?.destroy();
				this.previewViews.delete(path);
			}
		}
	}

	handleActiveLeafChange(leaf: WorkspaceLeaf | null) {
    if (!(leaf?.view instanceof MarkdownView)) return;
    const file = leaf.view.file;
    if (!file) return;

    const fileCache = this.app.metadataCache.getFileCache(file);
    const isPreso = fileCache?.frontmatter?.preso;

    if (isPreso) {
        // Only auto-activate on desktop. On mobile, the user must use the command.
        if (!(this.app as any).isMobile) {
            if (!this.previewViews.has(file.path)) {
                this.activateSlides(leaf);
            }
        }
    } else {
        // If it's NOT a presentation file, always deactivate any existing preview on any device.
        this.deactivateSlides(leaf);
    }
  }

	activateSlides(leaf: WorkspaceLeaf) {
		const view = leaf.view as MarkdownView;
		const file = view.file;
		if (!file || this.previewViews.has(file.path)) return;

		const previewView = new SlidePreviewView(this.app, view.containerEl);
		previewView.create();
		this.previewViews.set(file.path, previewView);

		const update = async () => {
			const content = view.editor.getValue();
			const slides = getSlidesWithBoundaries(content);
			const cursor = view.editor.getCursor();

			const currentCache = this.app.metadataCache.getFileCache(file);
			const presoValue = currentCache?.frontmatter?.preso;

			previewView.setTheme(
				typeof presoValue === "string" ? presoValue : null,
			);

			const currentSlideIndex = slides.findIndex(
				(slide) =>
					cursor.line >= slide.startLine &&
					cursor.line <= slide.endLine,
			);

			if (currentSlideIndex === -1) {
				await previewView.update("", file.path);
				previewView.setExtras({});
				return;
			}

			const currentSlide = slides[currentSlideIndex];

    if (currentSlide.speakerNotes.length > 0) {
          console.log(`🎤 Speaker Notes (Slide ${currentSlideIndex + 1}):`, currentSlide.speakerNotes);
      }

			// --- State management for directives ---
			let footerText: string | null = null;
			let footerImage: string | null = null;
			let slideNumbers = false;

			for (let i = 0; i <= currentSlideIndex; i++) {
        const slide = slides[i];
        if ('footer' in slide.directives) {
            footerText = slide.directives['footer'] === 'empty' ? null : slide.directives['footer'];
        }
        if ('footer-image' in slide.directives) {
            footerImage = slide.directives['footer-image'] === 'empty' ? null : slide.directives['footer-image'];
        }
        if ('slidenumbers' in slide.directives) {
            slideNumbers = slide.directives['slidenumbers'] === 'true';
        }
      }

			let showSlideNumberOnThisSlide = slideNumbers;
			if (currentSlide.directives["slidenumbers"] === "false") {
				showSlideNumberOnThisSlide = false;
			}
			// --- End State Management ---

			await previewView.update(currentSlide.content, file.path);

			let footerImageSrc: string | null = null;
			if (footerImage) {
				const imageMatch = footerImage.match(/!\[\[(.*?)\]\]/);
				if (imageMatch) {
					const imageName = imageMatch[1];
					const imageFile =
						this.app.metadataCache.getFirstLinkpathDest(
							imageName,
							file.path,
						);
					if (imageFile instanceof TFile) {
						footerImageSrc =
							this.app.vault.getResourcePath(imageFile);
					}
				}
			}

			previewView.setExtras({
				footerText: footerText,
				footerImageSrc: footerImageSrc,
				slideNumber: showSlideNumberOnThisSlide
					? `${currentSlideIndex + 1} / ${slides.length}`
					: null,
			});
		};

		previewView.registerDomEvent(view.contentEl, "click", update);
		update();
		previewView.show();
		previewView.registerEvent(
			this.app.workspace.on("editor-change", () => update()),
		);
	}

	deactivateSlides(leaf: WorkspaceLeaf) {
		const view = leaf.view as MarkdownView;
		const file = view.file;
		if (file && this.previewViews.has(file.path)) {
			this.previewViews.get(file.path)?.destroy();
			this.previewViews.delete(file.path);
		}
	}
}
