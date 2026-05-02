export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.body || {};

  if (action === 'fetch_news') {
    try {
      const rssRes = await fetch('https://newstsukuba.jp/feed/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Boh/1.0)' }
      });
      const xml = await rssRes.text();

      const items = [];
      const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
      for (const match of itemMatches) {
        const item = match[1];
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || '';
        const date  = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] || '';
        const desc  = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1] || '';
        const cat   = (item.match(/<category><!\[CDATA\[(.*?)\]\]><\/category>/) || item.match(/<category>(.*?)<\/category>/))?.[1] || 'ニュース';
        if (title) {
          items.push({
            title:    title.trim(),
            category: cat.trim(),
            date:     date.trim(),
            summary:  desc.replace(/<[^>]*>/g, '').substring(0, 200).trim()
          });
        }
        if (items.length >= 6) break;
      }
      return res.status(200).json({ articles: items });
    } catch (err) {
      return res.status(500).json({ error: 'RSSの取得に失敗しました: ' + err.message });
    }
  }

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
