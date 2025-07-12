// Exporter.ts

import { App, Notice, MarkdownView, TFile, Component, MarkdownRenderer } from "obsidian";
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
    
    /* --- Notes Toggle Button Style (shared) --- */
    .nav-label.notes-toggle {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 32px;
        height: 32px;
        border: 2px solid rgba(0, 0, 0, 0.4);
        border-radius: 50%;
        color: rgba(0, 0, 0, 0.5);
    }

    .nav-label.notes-toggle:hover {
        color: rgba(255, 255, 255, 0.9);
        border-color: rgba(255, 255, 255, 0.8);
    }

    .notes-content {
        font-family: "Inter";
        font-size: 16px;
    }
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

		let footerText: string | null = null;
		let footerImage: string | null = null;
		let slideNumbers = false;

		const slidePromises = allSlides.map(async (currentSlide, index) => {
			if ('footer' in currentSlide.directives) {
                footerText = currentSlide.directives['footer'] === 'empty' ? null : currentSlide.directives['footer'];
            }
            if ('footer-image' in currentSlide.directives) {
                footerImage = currentSlide.directives['footer-image'] === 'empty' ? null : currentSlide.directives['footer-image'];
            }
            if ('slidenumbers' in currentSlide.directives) {
                slideNumbers = currentSlide.directives['slidenumbers'] === 'true';
            }

			let showSlideNumberOnThisSlide = slideNumbers;
			if (currentSlide.directives["slidenumbers"] === "false") {
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
							file.path,
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
					? `${index + 1} / ${allSlides.length}`
					: null,
			};

            const speakerNotesMarkdown = currentSlide.speakerNotes.join('\n');

			const [slideHtml, speakerNotesHtml] = await Promise.all([
                this.renderSlideToHtml(currentSlide.content, file.path, theme, extras),
                this.renderMarkdownToHtml(speakerNotesMarkdown, file.path)
            ]);

            return { slideHtml, speakerNotesHtml };
		});

		const [combinedCss, renderedSlides] = await Promise.all([
			this.getCombinedCss(),
			Promise.all(slidePromises),
		]);

        const slidesHtml = renderedSlides.map(s => s.slideHtml);
        const speakerNotesHtml = renderedSlides.map(s => s.speakerNotesHtml);


		const finalHtml = cssOnly
			? this.createCssOnlyHtmlDocument(
					file.basename,
					slidesHtml,
                    speakerNotesHtml,
					combinedCss,
					bodyThemeClass,
				)
			: this.createHtmlDocument(
					file.basename,
					slidesHtml,
                    speakerNotesHtml,
					combinedCss,
					bodyThemeClass,
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

    private async renderMarkdownToHtml(markdownContent: string, sourcePath: string): Promise<string> {
        if (!markdownContent) return "";
        const tempContainer = createDiv();
        const component = new Component();
        try {
            await MarkdownRenderer.render(this.app, markdownContent, tempContainer, sourcePath, component);
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
		},
	): Promise<string> {
		const tempContainer = createDiv();
		const tempSlide = new SlidePreviewView(this.app, tempContainer);
		tempSlide.create();
		tempSlide.setTheme(theme);

		await tempSlide.update(markdownContent, sourcePath);
		tempSlide.setExtras(extras);

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

    private createCssOnlyHtmlDocument(title: string, slidesHtml: string[], speakerNotesHtml: string[], css: string, bodyAndThemeClasses: string): string {
        const numSlides = slidesHtml.length;
        const bodyClass = bodyAndThemeClasses.includes('theme-dark') ? 'theme-dark' : 'theme-light';

        const radioInputs = slidesHtml.map((_, index) =>
            `<input type="radio" name="slide" id="s${index + 1}" ${index === 0 ? 'checked' : ''}>`
        ).join('\n');

        const slideMarkup = slidesHtml.map((slideOuterHtml, index) => {
            if (!slideOuterHtml) return '';
            const i = index + 1;
            const prev = (i === 1) ? numSlides : i - 1;
            const next = (i === numSlides) ? 1 : i + 1;
            const prevLabel = `<label for="s${prev}" class="nav-label prev"></label>`;
            const notesLabel = `<label for="notes-toggle" class="nav-label notes-toggle"></label>`;
            const nextLabel = `<label for="s${next}" class="nav-label next"></label>`;

            const navigationDiv = `<div class="navigation">${prevLabel}${notesLabel}${nextLabel}</div>`;
            const slideWithNav = slideOuterHtml.replace(/<\/div>$/, `${navigationDiv}</div>`);
            return `<div class="slide-wrapper">${slideWithNav.replace('class="', 'class="is-visible ')}</div>`;
        }).join('\n');

        const speakerNotesMarkup = speakerNotesHtml.map((notes, index) => 
            `<div class="notes-content" id="notes-for-s${index + 1}">${notes}</div>`
        ).join('\n');

        let dynamicCss = '';
        let dynamicNotesCss = '';
        for (let i = 1; i <= numSlides; i++) {
            dynamicCss += `#s${i}:checked ~ .slides-container .slide-wrapper:nth-of-type(${i}) { opacity: 1; pointer-events: auto; z-index: 1; }\n`;
            dynamicNotesCss += `#s${i}:checked ~ .speaker-notes-pane .notes-content-wrapper #notes-for-s${i} { display: block; }\n`;
        }

        const presentationCss = `
            ${presentationCssCommon}
            input[name="slide"], #notes-toggle { display: none; }
            
            .slides-container { 
                position: absolute;
                left: 0;
                top: 0;
                width: 100vw; 
                height: 100vh;
                transition: width 0.3s ease-in-out;
            }
            #notes-toggle:checked ~ .slides-container { width: 80vw; }
            ${dynamicCss}
            
            /* --- Speaker Notes Styles --- */
            .speaker-notes-pane {
                position: fixed;
                top: 0;
                right: 0;
                width: 0;
                height: 100vh;
                transition: width 0.3s ease-in-out;
                z-index: 10;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            #notes-toggle:checked ~ .speaker-notes-pane { width: 20vw; }

            .notes-content-wrapper {
                width: calc(100% - 2em);
                height: calc(80vw * 0.98 * 9 / 16);
                max-height: calc(98vh - 4em);
                border-radius: 12px;
                background-color: var(--background-secondary-alt, #1a1a1a);
                padding: 2em;
                box-sizing: border-box;
                overflow-y: auto;
                opacity: 0;
                transition: opacity 0.3s ease-in-out;
            }
            #notes-toggle:checked ~ .speaker-notes-pane .notes-content-wrapper {
                opacity: 1;
            }

            .speaker-notes-pane .notes-content { display: none; }
            .speaker-notes-pane h1, .speaker-notes-pane h2 { border: none; }
            ${dynamicNotesCss}
            
            #notes-toggle:checked ~ .slides-container .nav-label.notes-toggle {
                background-color: rgba(255, 255, 255, 0.2);
                color: rgba(255, 255, 255, 0.9);
            }
        `;

        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:;">
        <title>${title}</title>
        <style>${css}${presentationCss}</style>
    </head>
    <body class="${bodyClass}">
        ${radioInputs}
        <input type="checkbox" id="notes-toggle">

        <div class="slides-container">
            ${slideMarkup}
        </div>
        <div class="speaker-notes-pane">
             <div class="notes-content-wrapper">
                ${speakerNotesMarkup}
            </div>
        </div>
    </body>
    </html>`;
    }

    private createHtmlDocument(title: string, slidesHtml: string[], speakerNotesHtml: string[], css: string, bodyAndThemeClasses: string): string {
        const bodyClass = bodyAndThemeClasses.includes('theme-dark') ? 'theme-dark' : 'theme-light';
        
        const slideMarkup = slidesHtml.map((slideOuterHtml, index) => {
            if (!slideOuterHtml) return '';
            const prevLabel = `<div class="nav-label prev"></div>`;
            const notesLabel = `<div class="nav-label notes-toggle"></div>`;
            const nextLabel = `<div class="nav-label next"></div>`;
            const navigationDiv = `<div class="navigation">${prevLabel}${notesLabel}${nextLabel}</div>`;
            const slideWithNav = slideOuterHtml.replace(/<\/div>$/, `${navigationDiv}</div>`);
    
            return `<div class="slide-wrapper ${index === 0 ? 'active' : ''}">
                ${slideWithNav.replace('class="', 'class="is-visible ')}
             </div>`;
        }).join('\n');

        const speakerNotesMarkup = speakerNotesHtml.map((notes, index) => 
            `<div class="notes-content" id="notes-for-slide-${index}">${notes}</div>`
        ).join('\n');
    
        const presentationCss = `
            ${presentationCssCommon}
            body { display: flex; }
            .slides-container {
                width: 100vw;
                height: 100vh;
                position: relative;
                transition: width 0.3s ease-in-out;
            }
            .slide-wrapper.active {
                opacity: 1;
                pointer-events: auto;
                z-index: 1;
            }

            /* --- Speaker Notes Styles --- */
            .speaker-notes-pane {
                width: 0;
                height: 100vh;
                transition: width 0.3s ease-in-out;
                display: flex;
                justify-content: center;
                align-items: center;
                flex-shrink: 0;
            }
            .notes-content-wrapper {
                width: calc(100% - 2em);
                height: calc(80vw * 0.98 * 9 / 16);
                max-height: calc(98vh - 4em);
                border-radius: 12px;
                background-color: var(--background-secondary-alt, #1a1a1a);
                padding: 2em;
                box-sizing: border-box;
                overflow-y: auto;
                opacity: 0;
                transition: opacity 0.3s ease-in-out;
            }
            .speaker-notes-pane .notes-content { display: none; }
            .speaker-notes-pane h1, .speaker-notes-pane h2 { border: none; }

            /* --- JS-driven states --- */
            body.notes-visible .slides-container { width: 80vw; }
            body.notes-visible .speaker-notes-pane { width: 20vw; }
            body.notes-visible .notes-content-wrapper { opacity: 1; }
            body.notes-visible .nav-label.notes-toggle {
                background-color: rgba(0, 0, 0, 0.2);
                color: rgba(255, 255, 255, 0.9);
            }
        `;
    
        const navigationJs = `
            document.addEventListener('DOMContentLoaded', () => {
                let current = 0;
                let notesVisible = false;
                const slides = document.querySelectorAll('.slide-wrapper');
                const allNotes = document.querySelectorAll('.notes-content');
                const totalSlides = slides.length;

                const showNotesForSlide = (index) => {
                    allNotes.forEach((el, i) => {
                        el.style.display = i === index ? 'block' : 'none';
                    });
                };

                const showSlide = (index) => {
                    if (index < 0 || index >= totalSlides) return;
                    current = index;
                    slides.forEach((s, i) => s.classList.toggle('active', i === current));
                    if (notesVisible) {
                        showNotesForSlide(current);
                    }
                };

                document.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'PageDown') {
                        showSlide(current + 1);
                    } 
                    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
                        showSlide(current - 1);
                    }
                });

                document.body.addEventListener('click', (e) => {
                    if (e.target.classList.contains('next')) {
                        showSlide(current + 1);
                    } else if (e.target.classList.contains('prev')) {
                        showSlide(current - 1);
                    } else if (e.target.classList.contains('notes-toggle')) {
                        notesVisible = !notesVisible;
                        document.body.classList.toggle('notes-visible', notesVisible);
                        if (notesVisible) {
                            showNotesForSlide(current);
                        } else {
                            allNotes.forEach(el => el.style.display = 'none');
                        }
                    }
                });

                showSlide(0);
            });
        `;
    
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:;">
        <title>${title}</title>
        <style>${css}${presentationCss}</style>
    </head>
    <body class="${bodyClass}">
        <div class="slides-container">
            ${slideMarkup}
        </div>
        <div class="speaker-notes-pane">
            <div class="notes-content-wrapper">
                ${speakerNotesMarkup}
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