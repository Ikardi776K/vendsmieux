export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  const d = req.body || {};
  if (!d.nom || !d.cat || !d.etat) return res.status(400).json({ error: 'Champs manquants' });

  const base = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
  const model = process.env.AI_MODEL as string;
  const system = `Tu rédiges des annonces de vente d'occasion en français pour ${d.pf}.
Règles : n'invente JAMAIS une marque, un modèle, un état ou une caractéristique non fournie. Mentionne les défauts indiqués. Titre honnête et adapté à la plateforme. Donne un prix uniquement si tu as des données de marché fiables, sinon null.
Réponds UNIQUEMENT en JSON : {"title":string,"description":string,"features":[[libellé,valeur]],"keywords":string[],"price":string|null,"photoTips":string[]}`;

  const { photo, ...infos } = d;

  try {
    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + process.env.AI_API_KEY,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: 'Informations du vendeur : ' + JSON.stringify(infos) },
        ],
      }),
    });
    if (r.status === 429) return res.status(429).json({ error: 'Trop de demandes, réessayez dans une minute.' });
    if (!r.ok) {
      console.error('ERREUR FOURNISSEUR', r.status, await r.text());
      return res.status(502).json({ error: 'Service IA indisponible' });
    }
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    return res.status(200).json(JSON.parse(json));
  } catch (e) {
    console.error('ERREUR', e);
    return res.status(500).json({ error: 'Erreur de génération' });
  }
}
