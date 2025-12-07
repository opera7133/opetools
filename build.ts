import fs from "fs";
import path from "path";

const HEADER_START = "<!-- START HEADER -->";
const HEADER_END = "<!-- END HEADER -->";
const FOOTER_START = "<!-- START FOOTER -->";
const FOOTER_END = "<!-- END FOOTER -->";

const getComponentDir = () => {
  const currentFile = import.meta.url.replace("file://", "");
  return path.dirname(currentFile);
};

const componentDir = getComponentDir();

const headerContent = fs
  .readFileSync(
    path.join(componentDir, "src", "components", "header.html"),
    "utf-8"
  )
  .trim();
const footerContent = fs
  .readFileSync(
    path.join(componentDir, "src", "components", "footer.html"),
    "utf-8"
  )
  .trim();

// HTMLファイルを処理
const htmlFiles = ["index.html", "envelope.html", "pukiwiki.html"];

// distディレクトリが存在しなければ作成
const distDir = path.join(componentDir, "dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

htmlFiles.forEach((file) => {
  const filePath = path.join(componentDir, "src", "pages", file);
  let content = fs.readFileSync(filePath, "utf-8");

  // ヘッダーを開始・終了マーカー間で置き換え
  const headerRegex = new RegExp(`${HEADER_START}[\\s\\S]*?${HEADER_END}`, "g");
  content = content.replace(
    headerRegex,
    `${HEADER_START}\n    ${headerContent}\n    ${HEADER_END}`
  );

  // フッターを開始・終了マーカー間で置き換え
  const footerRegex = new RegExp(`${FOOTER_START}[\\s\\S]*?${FOOTER_END}`, "g");
  content = content.replace(
    footerRegex,
    `${FOOTER_START}\n    ${footerContent}\n    ${FOOTER_END}`
  );

  const outputPath = path.join(distDir, file);
  fs.writeFileSync(outputPath, content, "utf-8");
  console.log(`✓ ${file} を dist に保存しました`);
});

const publicDir = path.join(componentDir, "src", "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.cpSync(publicDir, path.join(distDir, "public"), {
  recursive: true,
});

console.log("ビルド完了: ヘッダーとフッターを挿入しました");
