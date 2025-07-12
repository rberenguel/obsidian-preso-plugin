// Parser.ts

export interface Slide {
	content: string;
	directives: Record<string, string>;
	startLine: number;
	endLine: number;
}

export function getSlidesWithBoundaries(rawContent: string): Slide[] {
	const slides: Slide[] = [];
	const lines = rawContent.split("\n");
	let slideStartIndex = 0;

	// Check for and skip YAML frontmatter
	if (lines[0]?.trim() === "---") {
		const frontmatterEndIndex = lines.slice(1).indexOf("---");
		if (frontmatterEndIndex !== -1) {
			slideStartIndex = frontmatterEndIndex + 2;
		}
	}

	let currentSlideLines: string[] = [];
	let startLine = slideStartIndex;

	const processSlide = (slideContent: string, start: number, end: number) => {
		const slideLines = slideContent.split("\n");
		const directives: Record<string, string> = {};
		let contentStartIndex = 0;

		const directiveRegex = /^\s*([a-zA-Z0-9_-]+):\s*(.*)\s*$/;

		for (let i = 0; i < slideLines.length; i++) {
			const line = slideLines[i];
			const match = line.match(directiveRegex);
			if (match) {
				const key = match[1].toLowerCase();
				const value = match[2].trim();
				directives[key] = value;
				contentStartIndex = i + 1;
			} else {
				// Stop at the first non-directive line
				break;
			}
		}

		const content = slideLines.slice(contentStartIndex).join("\n");
		slides.push({
			content: content,
			directives: directives,
			startLine: start,
			endLine: end,
		});
	};

	for (let i = slideStartIndex; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "---") {
			processSlide(currentSlideLines.join("\n"), startLine, i - 1);
			startLine = i + 1;
			currentSlideLines = [];
		} else {
			currentSlideLines.push(line);
		}
	}

	processSlide(currentSlideLines.join("\n"), startLine, lines.length - 1);

	return slides.filter(
		(s) => s.content.trim() !== "" || Object.keys(s.directives).length > 0,
	);
}
