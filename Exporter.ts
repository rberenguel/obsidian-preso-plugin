// Exporter.ts

import { App, Notice, MarkdownView, TFile } from "obsidian";
import { SlidePreviewView } from "./SlidePreviewView";
import { getSlidesWithBoundaries, Slide } from "./Parser";

const presentationCssCommon = `
    body { margin: 0; background-color: var(--background-primary, #1c1c1c); overflow: hidden; }
    .slide-wrapper {
        display: flex;
        width: 100vw;
        height: 100vh;
        justify-content: center;
        align-items: center;
        position: absolute;
        top: 0;
        left: 0;
        opacity: 0;
        transition: opacity 0.4s ease-in-out;
        pointer-events: none;
    }
    .slide-preview {
        aspect-ratio: 16 / 9;
        width: 98vw;
        height: calc(98vw * 9 / 16);
        max-width: 98vw;
        max-height: 98vh;
        position: relative !important;
        top: auto !important;
        right: auto !important;
        transform: none !important;
        container-type: size !important;
    }

    /* --- Common Navigation Styles for Export --- */
    .slide-preview .navigation {
        position: absolute;
        bottom: 20px;
        left: 20px;
        right: 20px;
        height: 40px;
        display: flex;
        justify-content: space-between;
        z-index: 1000;
        pointer-events: none;
    }
    .nav-label { 
        pointer-events: all;
        display: flex;
        justify-content: center;
        cursor: pointer;
        user-select: none;
        transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out;
        opacity: 0;
    }
    .slide-preview .nav-label.next {
        width: 0;
        height: 0;
        border-top: 20px solid transparent;
        border-bottom: 20px solid transparent;
        border-left: 20px solid rgba(0, 0, 0, 0.4); /* This creates the triangle */
    }
    .slide-preview .nav-label.prev {
        width: 0;
        height: 0;
        border-top: 20px solid transparent;
        border-bottom: 20px solid transparent;
        border-right: 20px solid rgba(0, 0, 0, 0.4); /* This creates the triangle */
    }

    .slide-preview:hover .nav-label {
        opacity: 0.8;
    }
    .slide-preview .nav-label.prev:hover {
        opacity: 1;
        border-top: 20px solid transparent;
        border-bottom: 20px solid transparent;
        border-right: 20px solid rgba(90, 90, 90, 0.4); /* This creates the triangle */
    }
    .slide-preview .nav-label.next:hover {
        opacity: 1;
        border-top: 20px solid transparent;
        border-bottom: 20px solid transparent;
        border-left: 20px solid rgba(90, 90, 90, 0.4); /* This creates the triangle */
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
		const allSlides = getSlidesWithBoundaries(content); // Use the parser to get full slide objects
		const fileCache = this.app.metadataCache.getFileCache(file);
		const themeValue = fileCache?.frontmatter?.preso;
		const theme = typeof themeValue === "string" ? themeValue : null;

		const bodyThemeClass = document.body.className.includes("theme-dark")
			? "theme-dark"
			: "theme-light";

		new Notice(`Exporting ${allSlides.length} slides...`);

		// --- State management for directives, same as in main.ts ---
		let footerText: string | null = null;
		let footerImage: string | null = null;
		let slideNumbers = false;

		const slideHtmlPromises = allSlides.map(async (currentSlide, index) => {
			// Update state based on current slide's directives
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

			// Resolve footer image path
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

			return this.renderSlideToHtml(
				currentSlide.content,
				file.path,
				theme,
				extras,
			);
		});

		const [combinedCss, slidesHtml] = await Promise.all([
			this.getCombinedCss(),
			Promise.all(slideHtmlPromises),
		]);

		const finalHtml = cssOnly
			? this.createCssOnlyHtmlDocument(
					file.basename,
					slidesHtml,
					combinedCss,
					bodyThemeClass,
				)
			: this.createHtmlDocument(
					file.basename,
					slidesHtml,
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

		// Set the extras (footer, etc.) on the temporary view before serializing
		tempSlide.setExtras(extras);

		const floatingEl = tempContainer.firstElementChild as HTMLElement;
		if (floatingEl) {
			// The image conversion logic needs to run *after* setExtras adds the footer image
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

    private createCssOnlyHtmlDocument(title: string, slidesHtml: string[], css: string, bodyAndThemeClasses: string): string {
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

            // Use the unified .nav-label class
            const prevLabel = `<label for="s${prev}" class="nav-label prev">‹</label>`;
            const nextLabel = `<label for="s${next}" class="nav-label next">›</label>`;
            const navigationDiv = `<div class="navigation">${prevLabel}${nextLabel}</div>`;
            const slideWithNav = slideOuterHtml.replace(/<\/div>$/, `${navigationDiv}</div>`);

            return `<div class="slide-wrapper">
                ${slideWithNav.replace('class="', 'class="is-visible ')}
             </div>`;
        }).join('\n');

        let dynamicCss = '';
        for (let i = 1; i <= numSlides; i++) {
            dynamicCss += `#s${i}:checked ~ .slides-container .slide-wrapper:nth-of-type(${i}) { opacity: 1; pointer-events: auto; z-index: 1; }\n`;
        }

        const presentationCss = `
            ${presentationCssCommon}
            input[name="slide"] { display: none; }
            .slides-container { position: relative; width: 100vw; height: 100vh; }
            ${dynamicCss}
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
        <div class="slides-container">
            ${slideMarkup}
        </div>
    </body>
    </html>`;
    }

    private createHtmlDocument(title: string, slidesHtml: string[], css: string, bodyAndThemeClasses: string): string {
        const bodyClass = bodyAndThemeClasses.includes('theme-dark') ? 'theme-dark' : 'theme-light';
        
        const slideMarkup = slidesHtml.map((slideOuterHtml, index) => {
            if (!slideOuterHtml) return '';
            // Add div-based buttons with the .nav-button class
            const prevButton = `<div class="nav-label prev"></div>`;
            const nextButton = `<div class="nav-label next"></div>`;
            const navigationDiv = `<div class="navigation">${prevButton}${nextButton}</div>`;
            const slideWithNav = slideOuterHtml.replace(/<\/div>$/, `${navigationDiv}</div>`);
    
            return `<div class="slide-wrapper ${index === 0 ? 'active' : ''}">
                ${slideWithNav.replace('class="', 'class="is-visible ')}
             </div>`;
        }).join('\n');
    
        const presentationCss = `
            ${presentationCssCommon}
            .slide-wrapper.active {
                opacity: 1;
                pointer-events: auto;
                z-index: 1;
            }
        `;
    
        // Add click handlers for the new buttons
        const navigationJs = `
            document.addEventListener('DOMContentLoaded', () => {
                let current = 0;
                const slides = document.querySelectorAll('.slide-wrapper');
                const totalSlides = slides.length;

                const showSlide = (index) => {
                    if (index < 0 || index >= totalSlides) return;
                    current = index;
                    slides.forEach((s, i) => s.classList.toggle('active', i === current));
                };

                // Keyboard navigation
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'PageDown') {
                        showSlide(current + 1);
                    } 
                    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
                        showSlide(current - 1);
                    }
                });

                // Click navigation using event delegation
                document.querySelector('body').addEventListener('click', (e) => {
                    if (e.target.classList.contains('next')) {
                        showSlide(current + 1);
                    } else if (e.target.classList.contains('prev')) {
                        showSlide(current - 1);
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
