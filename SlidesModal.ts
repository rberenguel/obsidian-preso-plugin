// SlidesModal.ts

import { App, Modal, TFile } from "obsidian";
import { Slide } from "./Parser";
import { SlidePreviewView } from "./SlidePreviewView";

export class SlidesModal extends Modal {
	private slides: Slide[];
	private sourcePath: string;
	private theme: string | null;
	private slideViews: SlidePreviewView[] = [];

	constructor(
		app: App,
		slides: Slide[],
		sourcePath: string,
		theme: string | null,
	) {
		super(app);
		this.slides = slides;
		this.sourcePath = sourcePath;
		this.theme = theme;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("slides-modal");

		// --- Replicate state management from main.ts/Exporter.ts ---
		let footerText: string | null = null;
		let footerImage: string | null = null;
		let slideNumbers = false;

		for (const [index, slide] of this.slides.entries()) {
			// Update state
			if ("footer" in slide.directives) {
				footerText =
					slide.directives["footer"] === "empty"
						? null
						: slide.directives["footer"];
			}
			if ("footer-image" in slide.directives) {
				footerImage =
					slide.directives["footer-image"] === "empty"
						? null
						: slide.directives["footer-image"];
			}
			if ("slidenumbers" in slide.directives) {
				slideNumbers = slide.directives["slidenumbers"] === "true";
			}

			// Determine extras for this specific slide
			let showSlideNumberOnThisSlide = slideNumbers;
			if (slide.directives["slidenumbers"] === "false") {
				showSlideNumberOnThisSlide = false;
			}

			let footerImageSrc: string | null = null;
			if (footerImage) {
				const imageMatch = footerImage.match(/!\[\[(.*?)\]\]/);
				if (imageMatch) {
					const imageName = imageMatch[1];
					const imageFile =
						this.app.metadataCache.getFirstLinkpathDest(
							imageName,
							this.sourcePath,
						);
					if (imageFile instanceof TFile) {
						footerImageSrc =
							this.app.vault.getResourcePath(imageFile);
					}
				}
			}

			const extras = {
				footerText: footerText,
				footerImageSrc: footerImageSrc,
				slideNumber: showSlideNumberOnThisSlide
					? `${index + 1} / ${this.slides.length}`
					: null,
			};

			// --- Render the slide using SlidePreviewView ---
			const slideContainer = contentEl.createEl("div", {
				cls: "slide-container",
			});
			const slideView = new SlidePreviewView(this.app, slideContainer);
			this.slideViews.push(slideView);

			slideView.create();
			slideView.setTheme(this.theme);
			await slideView.update(slide.content, this.sourcePath);
			slideView.setExtras(extras);
			slideView.show(); // Make sure the .is-visible class is added
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.slideViews.forEach((view) => view.destroy());
	}
}
