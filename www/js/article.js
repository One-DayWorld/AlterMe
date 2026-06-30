// article.js — 喂文章
// 链接抓正文: 移植自原 main.js fetchUrlText 的"剥标签提正文"逻辑，curl → CapacitorHttp.get(Net.getText)。
// 也支持直接粘贴正文(移动端最稳，覆盖任何能复制的文章)。

const Article = (() => {
  // 从 HTML 提取 {title, text}（与原 fetchUrlText 一致的正则清洗）
  function extractFromHtml(html, url) {
    html = html || '';
    const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleM ? titleM[1].replace(/\s+/g, ' ').trim().slice(0, 80) : (url || '文章');
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    return { title, text };
  }

  async function fetchUrl(url) {
    if (!/^https?:\/\//i.test(url || '')) throw new Error('不是有效的链接');
    const html = await Net.getText(url, { 'User-Agent': 'Mozilla/5.0 AlterMe/1.0' });
    const { title, text } = extractFromHtml(html, url);
    if (!text || text.length < 80) throw new Error('未能从该链接提取到正文(可能需要登录或是动态页面)，可改用「粘贴正文」');
    return { title, text };
  }

  return { extractFromHtml, fetchUrl };
})();
