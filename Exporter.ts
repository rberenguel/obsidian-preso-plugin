// Exporter.ts

import {
	App,
	Notice,
	MarkdownView,
	TFile,
	Component,
	MarkdownRenderer,
} from "obsidian";
import { SlidePreviewView } from "./SlidePreviewView";
import { getSlidesWithBoundaries, Slide } from "./Parser";

const presentationCssCommon = `
    body { margin: 0; background-color: var(--background-primary, #1c1c1c); overflow: hidden; }
    .slide-wrapper {
        display: flex;
        width: 100%; 
        height: 100%;
        justify-content: center;
        align-items: center;
        position: absolute;
        top: 0;
        left: 0;
        opacity: 0;
        transition: opacity 0.4s ease-in-out, transform 0.3s ease-in-out;
        pointer-events: none;
    }
    .slide-preview {
        aspect-ratio: 16 / 9;
        width: 98%; 
        max-width: 98%;
        max-height: 98%;
        position: relative !important;
        top: auto !important;
        right: auto !important;
        transform: none !important;
        container-type: size !important;
    }

    /* --- Common Navigation Styles for Export --- */
    .slide-preview .navigation {
        position: absolute;
        bottom: 10px;
        left: 20px;
        right: 20px;
        height: 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 1000;
        pointer-events: none;
    }
    .nav-label { 
        pointer-events: all;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        user-select: none;
        transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out, color 0.2s ease-in-out;
        opacity: 0;
    }
    .slide-preview .nav-label.next {
        width: 0;
        height: 0;
        border-top: 20px solid transparent;
        border-bottom: 20px solid transparent;
        border-left: 20px solid rgba(0, 0, 0, 0.4); 
    }
    .slide-preview .nav-label.prev {
        width: 0;
        height: 0;
        border-top: 20px solid transparent;
        border-bottom: 20px solid transparent;
        border-right: 20px solid rgba(0, 0, 0, 0.4); 
    }

    .slide-preview:hover .nav-label {
        opacity: 0.8;
    }
    .slide-preview .nav-label.prev:hover {
        opacity: 1;
        border-right-color: rgba(90, 90, 90, 0.4);
    }
    .slide-preview .nav-label.next:hover {
        opacity: 1;
        border-left-color: rgba(90, 90, 90, 0.4);
    }
    
    /* --- Notes & Overview Toggle Button Style (shared) --- */
    .nav-label.notes-toggle, .nav-label.overview-toggle {
        position: absolute;
        left: 50%;
        width: 32px;
        height: 32px;
        border: 4px solid rgba(0, 0, 0, 0.4);
        color: rgba(0, 0, 0, 0.5);
    }
    .nav-label.notes-toggle {
        transform: translateX(30px);
        border-radius: 50%;
    }
     .nav-label.overview-toggle {
        transform: translateX(-30px);
        border-radius: 4px;
    }
    .nav-label.notes-toggle:hover, .nav-label.overview-toggle:hover {
        color: rgba(0, 0, 0, 0.9);
        border-color: rgba(0, 0, 0, 0.8);
    }

    .notes-content {
        font-size: 16px;
    }
    .mini-slide-content { padding: 5px; font-size: 14px; font-family: var(--font-interface); color: var(--text-muted); overflow: hidden; }
`;

export class Exporter {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	public async exportPresentationAsHtml(cssOnly: boolean = false) {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !activeView.file) {
			new Notice("No active presentation file to export.");
			return;
		}

		const file = activeView.file;
		const content = await this.app.vault.read(file);
		const allSlides = getSlidesWithBoundaries(content);
		const fileCache = this.app.metadataCache.getFileCache(file);
		const themeValue = fileCache?.frontmatter?.preso;
		const theme = typeof themeValue === "string" ? themeValue : null;

		const bodyThemeClass = document.body.className.includes("theme-dark")
			? "theme-dark"
			: "theme-light";

		new Notice(`Exporting ${allSlides.length} slides...`);

		let faviconDataUrl: string | null = null;
		const getImagePath = (directiveValue: string | null): string | null => {
			if (!directiveValue) return null;
			const imageMatch = directiveValue.match(/!\[\[(.*?)\]\]/);
			if (imageMatch) {
				const imageName = imageMatch[1];
				const imageFile = this.app.metadataCache.getFirstLinkpathDest(
					imageName,
					file.path,
				);
				if (imageFile instanceof TFile) {
					return this.app.vault.getResourcePath(imageFile);
				}
			}
			return null;
		};

		for (const slide of allSlides) {
			if ("favicon" in slide.directives) {
				const faviconPath = getImagePath(slide.directives["favicon"]);
				if (faviconPath) {
					faviconDataUrl = await this.convertUrlToBase64(faviconPath);
					break; // Use the first one found
				}
			}
		}

		let footerText: string | null = null;
		let footerImage: string | null = null;
		let slideNumbers = false;
		let headerText: string | null = null;
		let headerImage: string | null = null;
		let topLeftIcon: string | null = null;
		let topRightIcon: string | null = null;

		const slidePromises = allSlides.map(async (currentSlide, index) => {
			if ("footer" in currentSlide.directives) {
				footerText =
					currentSlide.directives["footer"] === "empty"
						? null
						: currentSlide.directives["footer"];
			}
			if ("footer-image" in currentSlide.directives) {
				footerImage =
					currentSlide.directives["footer-image"] === "empty"
						? null
						: currentSlide.directives["footer-image"];
			}
			if ("slidenumbers" in currentSlide.directives) {
				slideNumbers =
					currentSlide.directives["slidenumbers"] === "true";
			}
			if ("header" in currentSlide.directives) {
				headerText =
					currentSlide.directives["header"] === "empty"
						? null
						: currentSlide.directives["header"];
			}
			if ("header-image" in currentSlide.directives) {
				headerImage =
					currentSlide.directives["header-image"] === "empty"
						? null
						: currentSlide.directives["header-image"];
			}
			if ("top-left-icon" in currentSlide.directives) {
				topLeftIcon =
					currentSlide.directives["top-left-icon"] === "empty"
						? null
						: currentSlide.directives["top-left-icon"];
			}
			if ("top-right-icon" in currentSlide.directives) {
				topRightIcon =
					currentSlide.directives["top-right-icon"] === "empty"
						? null
						: currentSlide.directives["top-right-icon"];
			}

			let showSlideNumberOnThisSlide = slideNumbers;
			if (currentSlide.directives["slidenumbers"] === "false") {
				showSlideNumberOnThisSlide = false;
			}

			const extras = {
				footerText: footerText,
				footerImageSrc: getImagePath(footerImage),
				slideNumber: showSlideNumberOnThisSlide
					? `${index + 1} / ${allSlides.length}`
					: null,
				headerText: headerText,
				headerImageSrc: getImagePath(headerImage),
				topLeftIconSrc: getImagePath(topLeftIcon),
				topRightIconSrc: getImagePath(topRightIcon),
			};

			const speakerNotesMarkdown = currentSlide.speakerNotes.join("\n");

			const [slideHtml, speakerNotesHtml] = await Promise.all([
				this.renderSlideToHtml(
					currentSlide.content,
					file.path,
					theme,
					extras,
				),
				this.renderMarkdownToHtml(speakerNotesMarkdown, file.path),
			]);

			return { slideHtml, speakerNotesHtml };
		});

		const [combinedCss, renderedSlides] = await Promise.all([
			this.getCombinedCss(),
			Promise.all(slidePromises),
		]);

		const slidesHtml = renderedSlides.map((s) => s.slideHtml);
		const speakerNotesHtml = renderedSlides.map((s) => s.speakerNotesHtml);

		const finalHtml = cssOnly
			? this.createCssOnlyHtmlDocument(
					file.basename,
					allSlides,
					slidesHtml,
					speakerNotesHtml,
					combinedCss,
					bodyThemeClass,
					faviconDataUrl,
				)
			: this.createHtmlDocument(
					file.basename,
					allSlides,
					slidesHtml,
					speakerNotesHtml,
					combinedCss,
					bodyThemeClass,
					faviconDataUrl,
				);

		const suffix = cssOnly ? ".css-only.html" : ".html";
		this.downloadFile(finalHtml, `${file.basename}${suffix}`);
	}

	private async getCombinedCss(): Promise<string> {
		const styleEls = Array.from(
			document.querySelectorAll('style, link[rel="stylesheet"]'),
		);
		const cssPromises = styleEls.map(async (el) => {
			try {
				if (el.tagName.toLowerCase() === "style") {
					return el.innerHTML;
				}
				if (
					el.tagName.toLowerCase() === "link" &&
					(el as HTMLLinkElement).rel === "stylesheet"
				) {
					const href = (el as HTMLLinkElement).href;
					if (!href) return "";
					const response = await fetch(href);
					return response.ok ? await response.text() : "";
				}
			} catch (e) {
				console.warn(`Could not read or fetch stylesheet:`, el, e);
			}
			return "";
		});
		const cssStrings = await Promise.all(cssPromises);
		return cssStrings.join("\n");
	}

	private async renderMarkdownToHtml(
		markdownContent: string,
		sourcePath: string,
	): Promise<string> {
		if (!markdownContent) return "";
		const tempContainer = createDiv();
		const component = new Component();
		try {
			await MarkdownRenderer.render(
				this.app,
				markdownContent,
				tempContainer,
				sourcePath,
				component,
			);
			const allImages = Array.from(tempContainer.querySelectorAll("img"));
			for (const img of allImages) {
				if (img.src.startsWith("app://")) {
					img.src = await this.convertUrlToBase64(img.src);
				}
			}
			return tempContainer.innerHTML;
		} finally {
			component.unload();
		}
	}

	private async renderSlideToHtml(
		markdownContent: string,
		sourcePath: string,
		theme: string | null,
		extras: {
			footerText?: string | null;
			footerImageSrc?: string | null;
			slideNumber?: string | null;
			headerText?: string | null;
			headerImageSrc?: string | null;
			topLeftIconSrc?: string | null;
			topRightIconSrc?: string | null;
		},
	): Promise<string> {
		const tempContainer = createDiv();
		const tempSlide = new SlidePreviewView(this.app, tempContainer);
		tempSlide.create();
		tempSlide.setTheme(theme);

		await tempSlide.update(markdownContent, sourcePath);
		await tempSlide.setExtras(extras, sourcePath);

		const floatingEl = tempContainer.firstElementChild as HTMLElement;
		if (floatingEl) {
			const allImages = Array.from(floatingEl.querySelectorAll("img"));
			for (const img of allImages) {
				if (img.src.startsWith("app://")) {
					img.src = await this.convertUrlToBase64(img.src);
				}
			}

			const elementsWithBg = [
				floatingEl,
				...Array.from(
					floatingEl.querySelectorAll(".split-image-pane, .bg-slice"),
				),
			];
			for (const el of elementsWithBg) {
				const htmlEl = el as HTMLElement;
				if (htmlEl.style.backgroundImage.includes("app://")) {
					const urlMatch = htmlEl.style.backgroundImage.match(
						/url\("?(app:\/\/.*?)"?\)/,
					);
					if (urlMatch && urlMatch[1]) {
						const dataUrl = await this.convertUrlToBase64(
							urlMatch[1],
						);
						htmlEl.style.backgroundImage = `url("${dataUrl}")`;
					}
				}
			}
			return floatingEl.outerHTML;
		}
		return "";
	}

	private createCssOnlyHtmlDocument(
		title: string,
		allSlides: Slide[],
		slidesHtml: string[],
		speakerNotesHtml: string[],
		css: string,
		bodyAndThemeClasses: string,
		faviconDataUrl: string | null,
	): string {
		const numSlides = allSlides.length;
		const bodyClass = bodyAndThemeClasses.includes("theme-dark")
			? "theme-dark"
			: "theme-light";

		const radioInputs = allSlides
			.map(
				(_, index) =>
					`<input type="radio" name="slide" id="s${index + 1}" ${index === 0 ? "checked" : ""}>`,
			)
			.join("\n");

		const slideMarkup = slidesHtml
			.map((slideOuterHtml, index) => {
				if (!slideOuterHtml) return "";
				const i = index + 1;
				const prev = i === 1 ? numSlides : i - 1;
				const next = i === numSlides ? 1 : i + 1;
				const prevLabel = `<label for="s${prev}" class="nav-label prev"></label>`;
				const notesLabel = `<label for="notes-toggle" class="nav-label notes-toggle"></label>`;
				const overviewLabel = `<label for="overview-toggle" class="nav-label overview-toggle"></label>`;
				const nextLabel = `<label for="s${next}" class="nav-label next"></label>`;
				const navigationDiv = `<div class="navigation">${prevLabel}${overviewLabel}${notesLabel}${nextLabel}</div>`;
				const slideWithNav = slideOuterHtml.replace(
					/<\/div>$/,
					`${navigationDiv}</div>`,
				);
				return `<div class="slide-wrapper">${slideWithNav.replace('class="', 'class="is-visible ')}</div>`;
			})
			.join("\n");

		const speakerNotesMarkup = speakerNotesHtml
			.map(
				(notes, index) =>
					`<div class="notes-content" id="notes-for-s${index + 1}">${notes}</div>`,
			)
			.join("\n");

		const miniSlidesMarkup = allSlides
			.map((slide, index) => {
				return `<label for="s${index + 1}" class="mini-slide-wrapper"><div class="mini-slide-content">${slide.previewText}</div></label>`;
			})
			.join("\n");

		let dynamicCss = "";
		let dynamicNotesCss = "";
		for (let i = 1; i <= numSlides; i++) {
			dynamicCss += `#s${i}:checked ~ .slides-container .slide-wrapper:nth-of-type(${i}) { opacity: 1; pointer-events: auto; z-index: 1; }\n`;
			dynamicNotesCss += `#s${i}:checked ~ .speaker-notes-pane .notes-content-wrapper #notes-for-s${i} { display: block; }\n`;
		}

		const presentationCss = `
            ${presentationCssCommon}
            input[type="radio"], input[type="checkbox"] { display: none; }
            .slides-overview-pane { position: fixed; left: 0; top: 0; height: 100vh; width: 0; background-color: rgba(0,0,0,0.2); overflow-y: auto; transition: width 0.3s ease-in-out; z-index: 20; padding-top: 10px; box-sizing: border-box; }
            .slides-container { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; transition: width 0.3s ease-in-out, left 0.3s ease-in-out; }
            .speaker-notes-pane { position: fixed; top: 0; right: 0; width: 0; height: 100vh; transition: width 0.3s ease-in-out; z-index: 10; display: flex; justify-content: center; align-items: center; }
            ${dynamicCss}
            #overview-toggle:checked ~ .slides-overview-pane { width: 10vw; }
            #overview-toggle:checked ~ .slides-container { left: 10vw; width: 90vw; }
            #overview-toggle:checked ~ .slides-container .overview-toggle { background-color: rgba(0, 0, 0, 0.2); }
            #notes-toggle:checked ~ .slides-container { width: 80vw; }
            #notes-toggle:checked ~ .speaker-notes-pane { width: 20vw; }
            #notes-toggle:checked ~ .slides-container .notes-toggle { background-color: rgba(0, 0, 0, 0.2); }
            #overview-toggle:checked ~ #notes-toggle:checked ~ .slides-container { left: 10vw; width: 70vw; }
            .mini-slide-wrapper { display: flex; align-items: center; justify-content: center; text-align: center; margin: 0 auto 10px auto; width: 90%; aspect-ratio: 16/9; cursor: pointer; border: 1px solid var(--background-modifier-border); border-radius: 4px; background-color: var(--background-primary); transition: border-color 0.2s; }
            .mini-slide-wrapper:hover { border-color: var(--interactive-accent); }
            .notes-content-wrapper { width: calc(100% - 2em); height: calc(80vw * 0.98 * 9 / 16); max-height: calc(98vh - 4em); border-radius: 12px; background-color: var(--background-secondary-alt, #1a1a1a); padding: 2em; box-sizing: border-box; overflow-y: auto; opacity: 0; transition: opacity 0.3s ease-in-out; }
            #notes-toggle:checked ~ .speaker-notes-pane .notes-content-wrapper { opacity: 1; }
            .speaker-notes-pane .notes-content { display: none; }
            .speaker-notes-pane h1, .speaker-notes-pane h2 { border: none; }
            ${dynamicNotesCss}
        `;

		const faviconTag = faviconDataUrl
			? `<link rel="icon" href="${faviconDataUrl}">`
			: "";

		return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:;">
        <title>${title}</title>
        ${faviconTag}
        <style>${css}${presentationCss}</style>
    </head>
    <body class="${bodyClass}">
        ${radioInputs}
        <input type="checkbox" id="overview-toggle">
        <input type="checkbox" id="notes-toggle">
        <div class="slides-overview-pane">${miniSlidesMarkup}</div>
        <div class="slides-container">${slideMarkup}</div>
        <div class="speaker-notes-pane"><div class="notes-content-wrapper">${speakerNotesMarkup}</div></div>
    </body>
    </html>`;
	}

	private createHtmlDocument(
		title: string,
		allSlides: Slide[],
		slidesHtml: string[],
		speakerNotesHtml: string[],
		css: string,
		bodyAndThemeClasses: string,
		faviconDataUrl: string | null,
	): string {
		const bodyClass = bodyAndThemeClasses.includes("theme-dark")
			? "theme-dark"
			: "theme-light";

		const slideMarkup = slidesHtml
			.map((slideOuterHtml, index) => {
				if (!slideOuterHtml) return "";
				const prevLabel = `<div class="nav-label prev"></div>`;
				const notesLabel = `<div class="nav-label notes-toggle"></div>`;
				const overviewLabel = `<div class="nav-label overview-toggle"></div>`;
				const nextLabel = `<div class="nav-label next"></div>`;
				const navigationDiv = `<div class="navigation">${prevLabel}${overviewLabel}${notesLabel}${nextLabel}</div>`;
				const slideWithNav = slideOuterHtml.replace(
					/<\/div>$/,
					`${navigationDiv}</div>`,
				);

				return `<div class="slide-wrapper ${index === 0 ? "active" : ""}">
                ${slideWithNav.replace('class="', 'class="is-visible ')}
             </div>`;
			})
			.join("\n");

		const speakerNotesMarkup = speakerNotesHtml
			.map(
				(notes, index) =>
					`<div class="notes-content" id="notes-for-slide-${index}">${notes}</div>`,
			)
			.join("\n");

		const miniSlidesMarkup = allSlides
			.map((slide, index) => {
				return `<div class="mini-slide-wrapper" data-slide-index="${index}"><div class="mini-slide-content">${slide.previewText}</div></div>`;
			})
			.join("\n");

		const presentationCss = `
            ${presentationCssCommon}
            #main-view { display: flex; width: 100%; height: 100%; }
            .slides-overview-pane { width: 0; height: 100vh; background-color: rgba(0,0,0,0.2); overflow-y: auto; transition: width 0.3s ease-in-out; z-index: 20; padding-top: 10px; box-sizing: border-box; flex-shrink: 0; }
            .slides-container { width: 100vw; height: 100vh; position: relative; transition: width 0.3s ease-in-out; flex-shrink: 0; }
            .speaker-notes-pane { width: 0; height: 100vh; transition: width 0.3s ease-in-out; display: flex; justify-content: center; align-items: center; flex-shrink: 0; }
            .slide-wrapper.active { opacity: 1; pointer-events: auto; z-index: 1; }
            .mini-slide-wrapper { display: flex; align-items: center; justify-content: center; text-align: center; margin: 0 auto 10px auto; width: 90%; aspect-ratio: 16/9; cursor: pointer; border: 1px solid var(--background-modifier-border); border-radius: 4px; background-color: var(--background-primary); transition: border-color 0.2s; }
            .mini-slide-wrapper:hover { border-color: var(--interactive-accent); }
            .notes-content-wrapper { width: calc(100% - 2em); height: calc(80vw * 0.98 * 9 / 16); max-height: calc(98vh - 4em); border-radius: 12px; background-color: var(--background-secondary-alt, #1a1a1a); padding: 2em; box-sizing: border-box; overflow-y: auto; opacity: 0; transition: opacity 0.3s ease-in-out; }
            .speaker-notes-pane .notes-content { display: none; }
            .speaker-notes-pane h1, .speaker-notes-pane h2 { border: none; }
            body.overview-visible .slides-overview-pane { width: 10vw; }
            body.overview-visible .slides-container { width: 90vw; }
            body.overview-visible .nav-label.overview-toggle { background-color: rgba(0, 0, 0, 0.2); }
            body.notes-visible .slides-container { width: 80vw; }
            body.notes-visible .speaker-notes-pane { width: 20vw; }
            body.notes-visible .notes-content-wrapper { opacity: 1; }
            body.notes-visible .nav-label.notes-toggle { background-color: rgba(0, 0, 0, 0.2); }
            body.overview-visible.notes-visible .slides-container { width: 70vw; }
            
            /* --- Presenter View Styles --- */
            #presenter-view { width: 100vw; height: 100vh; background-color: var(--background-secondary, #282828); color: var(--text-normal); font-family: sans-serif; display: none; }
            .presenter-main { flex: 3; display: flex; flex-direction: column; padding: 20px; gap: 20px; }
            .presenter-sidebar { flex: 1; display: flex; flex-direction: column; padding: 20px; gap: 20px; border-left: 1px solid var(--background-modifier-border); }
            .presenter-current-slide-container { flex: 2; display: flex; }
            .presenter-notes-container { flex: 1; padding: 10px; overflow-y: auto; }
            .presenter-next-slide-container, .presenter-prev-slide-container { flex: 1; display: flex; flex-direction: column; }
            .presenter-notes-container h3 { margin:0; padding-bottom:10px; border-bottom:1px solid var(--background-modifier-border); }
            .presenter-sidebar h4 { margin: 5px; padding-bottom: 5px; }
            .presenter-slide-host { flex: 1; display: flex; justify-content: center; align-items: center; overflow: hidden; }
            .presenter-slide-host > .slide-wrapper { position: relative; opacity: 1; pointer-events: auto; }
            .presenter-slide-host .slide-preview { border: none; box-shadow: none; width: 100%; height: auto; max-width: none; max-height: none; transform: scale(0.97); }
            .presenter-slide-host .navigation { display: none !important; }
            .presenter-controls { display: flex; gap: 10px; }
            .presenter-controls button { flex: 1; padding: 15px; font-size: 18px; cursor: pointer; }
        `;

		const navigationJs = `
            document.addEventListener('DOMContentLoaded', () => {
                const isPresenter = window.name === 'preso-presenter';
                const channel = new BroadcastChannel('preso-sync-channel');
                let presenterWindow = null;
                
                let current = 0;
                let notesVisible = false;
                let overviewVisible = false;

                const slides = Array.from(document.querySelectorAll('.slide-wrapper'));
                const allNotes = Array.from(document.querySelectorAll('.notes-content'));
                const totalSlides = slides.length;

                // --- Core Functions ---
                const showNotesForSlide = (index) => {
                    allNotes.forEach((el, i) => {
                        el.style.display = i === index ? 'block' : 'none';
                    });
                };
                
                const showSlide = (index) => {
                    current = (index + totalSlides) % totalSlides;
                    slides.forEach((s, i) => s.classList.toggle('active', i === current));
                    if (notesVisible) showNotesForSlide(current);
                    if (!isPresenter) broadcastState();
                };
                
                const broadcastState = () => {
                    if (isPresenter || !presenterWindow || presenterWindow.closed) return;

                    const prevIndex = (current - 1 + totalSlides) % totalSlides;
                    const nextIndex = (current + 1) % totalSlides;
                    
                    const message = {
                        type: 'state-update',
                        currentIndex: current,
                        currentSlideHtml: slides[current].innerHTML,
                        prevSlideHtml: slides[prevIndex].innerHTML,
                        nextSlideHtml: slides[nextIndex].innerHTML,
                        currentNotesHtml: allNotes[current].innerHTML,
                    };
                    channel.postMessage(message);
                };
                
                // --- Event Handlers & Logic ---
                channel.onmessage = (event) => {
                    const msg = event.data;
                    if (isPresenter) return;
                    
                    if (msg.type === 'command') {
                        if (msg.action === 'next') showSlide(current + 1);
                        else if (msg.action === 'prev') showSlide(current - 1);
                        else if (msg.action === 'presenter-ready') {
                            presenterWindow = window.open('', 'preso-presenter');
                            broadcastState();
                        } else if (msg.action === 'presenter-closing') {
                            presenterWindow = null;
                        }
                    }
                };
                
                if (isPresenter) {
                    // --- Presenter Window Logic ---
                    document.getElementById('main-view').style.display = 'none';
                    document.getElementById('presenter-view').style.display = 'flex';
                    
                    const currentHost = document.getElementById('presenter-current-slide');
                    const nextHost = document.getElementById('presenter-next-slide');
                    const prevHost = document.getElementById('presenter-prev-slide');
                    const notesHost = document.getElementById('presenter-notes');

                    document.getElementById('presenter-next-btn').onclick = () => channel.postMessage({ type: 'command', action: 'next' });
                    document.getElementById('presenter-prev-btn').onclick = () => channel.postMessage({ type: 'command', action: 'prev' });

                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'PageDown') {
                            e.preventDefault();
                            channel.postMessage({ type: 'command', action: 'next' });
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
                            e.preventDefault();
                            channel.postMessage({ type: 'command', action: 'prev' });
                        }
                    });

                    channel.onmessage = (event) => {
                        const msg = event.data;
                        if(msg.type !== 'state-update') return;
                        currentHost.innerHTML = msg.currentSlideHtml;
                        nextHost.innerHTML = msg.nextSlideHtml;
                        prevHost.innerHTML = msg.prevSlideHtml;
                        notesHost.innerHTML = msg.currentNotesHtml;
                    };
                    
                    window.addEventListener('beforeunload', () => channel.postMessage({ type: 'command', action: 'presenter-closing' }));
                    setTimeout(() => channel.postMessage({ type: 'command', action: 'presenter-ready' }), 200);

                } else {
                    // --- Main Window Logic ---
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'p' || e.key === 'P') {
                            e.preventDefault();
                            if (!presenterWindow || presenterWindow.closed) {
                                presenterWindow = window.open(window.location.href, 'preso-presenter', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no');
                            } else {
                                presenterWindow.focus();
                            }
                        }
                        else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'PageDown') showSlide(current + 1);
                        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') showSlide(current - 1);
                    });

                    document.body.addEventListener('click', (e) => {
                        const navTarget = e.target.closest('.nav-label');
                        const miniSlideTarget = e.target.closest('.mini-slide-wrapper');
                        if (!navTarget && !miniSlideTarget) return;

                        if (navTarget) {
                            if (navTarget.classList.contains('next')) showSlide(current + 1);
                            else if (navTarget.classList.contains('prev')) showSlide(current - 1);
                            else if (navTarget.classList.contains('notes-toggle')) {
                                notesVisible = !notesVisible;
                                document.body.classList.toggle('notes-visible', notesVisible);
                                if (notesVisible) showNotesForSlide(current);
                            } else if (navTarget.classList.contains('overview-toggle')) {
                                overviewVisible = !overviewVisible;
                                document.body.classList.toggle('overview-visible', overviewVisible);
                            }
                        } else if (miniSlideTarget) {
                            const index = parseInt(miniSlideTarget.dataset.slideIndex, 10);
                            if (!isNaN(index)) showSlide(index);
                        }
                    });

                    window.addEventListener('beforeunload', () => {
                        if (presenterWindow && !presenterWindow.closed) presenterWindow.close();
                    });
                    showSlide(0);
                }
            });
        `;

		const faviconTag = faviconDataUrl
			? `<link rel="icon" href="${faviconDataUrl}">`
			: "";

		return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:;">
        <title>${title}</title>
        ${faviconTag}
        <style>${css}${presentationCss}</style>
    </head>
    <body class="${bodyClass}">
        <div id="main-view">
            <div class="slides-overview-pane">${miniSlidesMarkup}</div>
            <div class="slides-container">${slideMarkup}</div>
            <div class="speaker-notes-pane"><div class="notes-content-wrapper">${speakerNotesMarkup}</div></div>
        </div>
        <div id="presenter-view">
            <div class="presenter-main">
                <div class="presenter-current-slide-container">
                    <div id="presenter-current-slide" class="presenter-slide-host"></div>
                </div>
                <div class="presenter-notes-container">
                    <h3>Speaker Notes</h3>
                    <div id="presenter-notes"></div>
                </div>
            </div>
            <div class="presenter-sidebar">
                 <div class="presenter-controls">
                    <button id="presenter-prev-btn">◀ Prev</button>
                    <button id="presenter-next-btn">Next ▶</button>
                </div>
                <div class="presenter-next-slide-container">
                    <h4>Next</h4>
                    <div id="presenter-next-slide" class="presenter-slide-host"></div>
                </div>
                <div class="presenter-prev-slide-container">
                    <h4>Previous</h4>
                    <div id="presenter-prev-slide" class="presenter-slide-host"></div>
                </div>
            </div>
        </div>

        <script>${navigationJs}</script>
    </body>
    </html>`;
	}

	private async convertUrlToBase64(url: string): Promise<string> {
		const response = await fetch(url);
		const blob = await response.blob();
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	private downloadFile(content: string, filename: string) {
		const blob = new Blob([content], { type: "text/html;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		new Notice(`Exported to ${filename}`);
	}
}
