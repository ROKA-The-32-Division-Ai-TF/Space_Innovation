interface ExportCanvasOptions {
  svgElement: SVGSVGElement;
  fileName: string;
  title: string;
  subtitle: string;
}

const collectStyleText = () => {
  const styleChunks: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        styleChunks.push(rule.cssText);
      }
    } catch {
      continue;
    }
  }

  return styleChunks.join("\n");
};

const serializeSvg = (svgElement: SVGSVGElement, title: string, subtitle: string) => {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  const width = svgElement.viewBox.baseVal?.width || svgElement.clientWidth || 1000;
  const height = svgElement.viewBox.baseVal?.height || svgElement.clientHeight || 800;
  const headerHeight = 68;

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("viewBox", `0 -${headerHeight} ${width} ${height + headerHeight}`);
  clone.setAttribute("width", `${width}`);
  clone.setAttribute("height", `${height + headerHeight}`);

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = collectStyleText();
  clone.insertBefore(style, clone.firstChild);

  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", `${-headerHeight}`);
  background.setAttribute("width", `${width}`);
  background.setAttribute("height", `${height + headerHeight}`);
  background.setAttribute("fill", "#f4f6f3");
  clone.insertBefore(background, clone.firstChild);

  const heading = document.createElementNS("http://www.w3.org/2000/svg", "text");
  heading.setAttribute("x", "20");
  heading.setAttribute("y", `${-headerHeight + 28}`);
  heading.setAttribute("fill", "#1f2b3a");
  heading.setAttribute("font-size", "20");
  heading.setAttribute("font-weight", "700");
  heading.setAttribute("font-family", "Pretendard, Apple SD Gothic Neo, Noto Sans KR, sans-serif");
  heading.textContent = title;
  clone.appendChild(heading);

  const subHeading = document.createElementNS("http://www.w3.org/2000/svg", "text");
  subHeading.setAttribute("x", "20");
  subHeading.setAttribute("y", `${-headerHeight + 50}`);
  subHeading.setAttribute("fill", "#5f6b78");
  subHeading.setAttribute("font-size", "12");
  subHeading.setAttribute("font-weight", "500");
  subHeading.setAttribute("font-family", "Pretendard, Apple SD Gothic Neo, Noto Sans KR, sans-serif");
  subHeading.textContent = subtitle;
  clone.appendChild(subHeading);

  return new XMLSerializer().serializeToString(clone);
};

export const exportCanvasToPng = async ({ svgElement, fileName, title, subtitle }: ExportCanvasOptions) => {
  const svgMarkup = serializeSvg(svgElement, title, subtitle);
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const width = svgElement.viewBox.baseVal?.width || svgElement.clientWidth || 1000;
        const height = (svgElement.viewBox.baseVal?.height || svgElement.clientHeight || 800) + 68;
        const scale = Math.max(window.devicePixelRatio, 2);
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("PNG 내보내기용 캔버스를 만들 수 없습니다."));
          return;
        }

        context.scale(scale, scale);
        context.drawImage(image, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("PNG 파일 생성에 실패했습니다."));
            return;
          }

          const link = document.createElement("a");
          const pngUrl = URL.createObjectURL(blob);
          link.href = pngUrl;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(pngUrl);
          resolve();
        }, "image/png");
      };

      image.onerror = () => reject(new Error("도면 이미지를 PNG로 변환하지 못했습니다."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
