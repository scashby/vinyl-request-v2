// api/create-event.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { title, date, time, location, info, image_url, allowed_form_, has_queue } = req.body;

  const { error, data } = await supabase.from('events').insert([{
    title,
    date,
    time,
    location,
    info,
    image_url,
    allowed_form_,
    has_queue
  }]);

  if (error) {
    console.error('Insert error:', error);
    return res.status(400).json({ error });
  }

  res.status(200).json({ data });
};
