import { App, MarkdownRenderer, Component } from "obsidian";
import interact from "interactjs";

export class SlidePreviewView {
	private app: App;
	private containerEl: HTMLElement;
	private component: Component;
	private floatingEl: HTMLElement | null;
	private visible: boolean = false;
	private currentTheme: string | null = null;
	private extrasEl: HTMLElement | null = null;

	constructor(app: App, containerEl: HTMLElement) {
		this.app = app;
		this.containerEl = containerEl;
		this.component = new Component();
		this.floatingEl = null;
	}

	create() {
		this.floatingEl = this.containerEl.createEl("div", {
			cls: "slide-preview",
		});

		interact(this.floatingEl)
			.draggable({
				inertia: true,
				modifiers: [
					interact.modifiers.restrictRect({
						restriction: "parent",
						endOnly: true,
					}),
				],
				autoScroll: true,
				listeners: {
					move: (event) => {
						const target = event.target;
						const x =
							(parseFloat(target.getAttribute("data-x")) || 0) +
							event.dx;
						const y =
							(parseFloat(target.getAttribute("data-y")) || 0) +
							event.dy;
						target.style.transform = `translate(${x}px, ${y}px)`;
						target.setAttribute("data-x", x);
						target.setAttribute("data-y", y);
					},
				},
			})
			.resizable({
				edges: { left: true, right: true, bottom: true, top: true },
				modifiers: [
					interact.modifiers.restrictEdges({
						outer: "parent",
					}),
					interact.modifiers.aspectRatio({
						ratio: 16 / 9,
					}),
					interact.modifiers.restrictSize({
						min: { width: 240, height: 135 },
					}),
				],
				listeners: {
					move: (event) => {
						const target = event.target;
						let x = parseFloat(target.getAttribute("data-x")) || 0;
						let y = parseFloat(target.getAttribute("data-y")) || 0;

						target.style.width = `${event.rect.width}px`;
						target.style.height = `${event.rect.height}px`;
						target.style.transform = `translate(${x}px, ${y}px)`;
						target.setAttribute("data-x", x);
						target.setAttribute("data-y", y);
					},
				},
				inertia: true,
			});
	}

	setTheme(theme: string | null | undefined) {
		if (!this.floatingEl) return;
		if (this.currentTheme) {
			this.floatingEl.classList.remove(this.currentTheme);
			this.currentTheme = null;
		}
		if (theme && typeof theme === "string") {
			this.floatingEl.classList.add(theme);
			this.currentTheme = theme;
		}
	}

	async update(markdownContent: string, sourcePath: string) {
		if (!this.floatingEl) return;

		this.floatingEl.innerHTML = "";
		this.floatingEl.style.backgroundImage = "";
		this.floatingEl.classList.remove(
			"layout-fill",
			"layout-bg",
			"layout-split",
			"split-left",
			"split-right",
		);

		const shadowHost = createDiv();
		await MarkdownRenderer.render(
			this.app,
			markdownContent,
			shadowHost,
			sourcePath,
			this.component,
		);

		const allImages = Array.from(shadowHost.querySelectorAll("img"));
		const isSimpleFill =
			allImages.length === 1 &&
			!allImages[0].alt.match(/^(bg|left|right)/) &&
			shadowHost.textContent?.trim() === "";
		if (isSimpleFill) {
			this.floatingEl.classList.add("layout-fill");
			this.floatingEl.style.backgroundImage = `url("${allImages[0].src}")`;
			return;
		}

		const imageInfos = allImages.map((img) => ({
			el: img,
			match: img.alt.match(/^(bg|left|right)(?:\s+(.*))?$/),
		}));

		const bgImageInfos = imageInfos.filter(
			(info) => info.match && info.match[1] === "bg",
		);
		const sideImageInfo = imageInfos.find(
			(info) => info.match && ["left", "right"].includes(info.match[1]),
		);

		if (bgImageInfos.length > 0) {
			this.floatingEl.classList.add("layout-bg");
			const sliceContainer = this.floatingEl.createEl("div", {
				cls: "bg-slice-container",
			});
			bgImageInfos.forEach((info) => {
				const slice = sliceContainer.createEl("div", {
					cls: "bg-slice",
				});
				slice.style.backgroundImage = `url("${info.el.src}")`;
				info.el.parentElement?.remove();
			});
			const bgWrapper = this.floatingEl.createEl("div", {
				cls: "bg-content-wrapper",
			});
			const filterArgs = bgImageInfos[0].match?.[2]?.trim();
			if (filterArgs) {
				bgWrapper.style.setProperty("--custom-bg-filter", filterArgs);
			} else {
				bgWrapper.style.removeProperty("--custom-bg-filter");
			}
			Array.from(shadowHost.querySelectorAll("p")).forEach((p) => {
				if (p.innerHTML.trim() === "") p.remove();
			});
			bgWrapper.append(...Array.from(shadowHost.childNodes));
		} else if (sideImageInfo) {
			const keyword = sideImageInfo.match![1];
			const specialImage = sideImageInfo.el;
			specialImage.parentElement?.remove();
			this.floatingEl.classList.add(
				"layout-split",
				keyword === "left" ? "split-left" : "split-right",
			);
			const imagePane = this.floatingEl.createEl("div", {
				cls: "split-image-pane",
			});
			const textPane = this.floatingEl.createEl("div", {
				cls: "split-text-pane",
			});
			imagePane.style.backgroundImage = `url("${specialImage.src}")`;
			Array.from(shadowHost.querySelectorAll("p")).forEach((p) => {
				if (p.innerHTML.trim() === "") p.remove();
			});
			textPane.append(...Array.from(shadowHost.childNodes));
		} else {
			this.floatingEl.append(...Array.from(shadowHost.childNodes));
		}

		if (this.floatingEl) {
			this.floatingEl.style.opacity = "0.999";
			requestAnimationFrame(() => {
				if (this.floatingEl) {
					this.floatingEl.style.opacity = "1";
				}
			});
		}
	}

	public setExtras(options: {
		footerText?: string | null;
		footerImageSrc?: string | null;
		slideNumber?: string | null;
	}) {
		if (!this.floatingEl) return;

		this.floatingEl.querySelector(".slide-extras-container")?.remove();

		if (
			!options.footerText &&
			!options.footerImageSrc &&
			!options.slideNumber
		) {
			return;
		}

		this.extrasEl = this.floatingEl.createEl("div", {
			cls: "slide-extras-container",
		});

		const footerContent = this.extrasEl.createEl("div", {
			cls: "footer-content",
		});
		if (options.footerImageSrc) {
			footerContent.createEl("img", {
				attr: { src: options.footerImageSrc },
				cls: "footer-image",
			});
		}
		if (options.footerText) {
			footerContent.createEl("span", {
				cls: "footer-text",
				text: options.footerText,
			});
		}

		if (options.slideNumber) {
			this.extrasEl.createEl("div", {
				cls: "slide-number",
				text: options.slideNumber,
			});
		}
	}

	show() {
		if (!this.floatingEl) return;
		this.floatingEl.classList.add("is-visible");
		this.visible = true;
	}

	hide() {
		if (!this.floatingEl) return;
		this.floatingEl.classList.remove("is-visible");
		this.visible = false;
	}

	toggle() {
		if (this.visible) {
			this.hide();
		} else {
			this.show();
		}
	}

	destroy() {
		if (this.floatingEl) {
			this.floatingEl.remove();
			this.floatingEl = null;
		}
		this.component.unload();
	}

	registerDomEvent<K extends keyof HTMLElementEventMap>(
		el: HTMLElement,
		type: K,
		callback: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions,
	) {
		this.component.registerDomEvent(el, type, callback, options);
	}

	registerEvent(eventRef: any) {
		this.component.registerEvent(eventRef);
	}

	public getInnerHtml(): string {
		return this.floatingEl ? this.floatingEl.innerHTML : "";
	}
}
