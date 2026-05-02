export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.body || {};

  // ニュース取得モード：つくば市新着情報ページをスクレイピング
  if (action === 'fetch_news') {
    try {
      const pageRes = await fetch('https://www.city.tsukuba.lg.jp/news_list.html', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en;q=0.9',
        }
      });
      const html = await pageRes.text();

      // 新着情報リストを抽出
      const items = [];
      // つくば市の新着情報はdl/dt/dd形式またはul/li形式
      const linkMatches = html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]{5,80})<\/a>/g);
      const seen = new Set();
      for (const match of linkMatches) {
        const href = match[1];
        const title = match[2].trim();
        // 不要なリンクを除外
        if (
          title.length < 5 ||
          href.includes('theme') ||
          href.includes('javascript') ||
          href.startsWith('#') ||
          seen.has(title)
        ) continue;
        seen.add(title);
        const cat = href.includes('kosodate') ? '子育て・教育'
          : href.includes('kenko') ? '健康・医療・福祉'
          : href.includes('kurashi') ? 'くらし・手続き'
          : href.includes('shisei') ? '市政情報'
          : href.includes('kankobunka') ? '観光・文化'
          : 'お知らせ';
        items.push({
          title,
          category: cat,
          date: new Date().toLocaleDateString('ja-JP'),
          summary: title
        });
        if (items.length >= 6) break;
      }

      if (items.length === 0) {
        // フォールバック：ハードコードのサンプル記事
        return res.status(200).json({ articles: [
          { title: 'つくば市イベント情報（2026年4月〜5月）', category: 'お知らせ', date: '2026年5月2日', summary: 'つくば市の4月から5月にかけてのイベント情報をまとめてお知らせします。' },
          { title: '物価高騰対策事業を実施しています', category: '市政情報', date: '2026年5月2日', summary: 'つくば市では物価高騰対策として市民向けの支援事業を実施しています。' },
          { title: '市政運営の所信と主要施策の概要', category: '市政情報', date: '2026年4月27日', summary: '令和8年度の市政運営方針と主要施策についてご説明します。' },
        ]});
      }

      return res.status(200).json({ articles: items });
    } catch (err) {
      return res.status(500).json({ error: 'ページの取得に失敗しました: ' + err.message });
    }
  }

  // ラジオ原稿生成モード（Claude Haiku使用・低トークン）
  if (action === 'generate_radio') {
    try {
      const { title, summary, apiKey } = req.body;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: 'あなたはAI-Boh（あいぼう）という地域ラジオのパーソナリティです。温かく親しみやすく語りかけます。220〜270字の語りテキストのみ返してください。記号・見出し不要。導入→本題→住民への問いかけの流れで。',
          messages: [{ role: 'user', content: `タイトル：${title}\n内容：${summary}\n\nこの記事をラジオの語り口に変換してください。` }]
        })
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'actionが不正です' });
}
