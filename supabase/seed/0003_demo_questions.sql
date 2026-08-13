-- ============================================================================
-- Seed 0003 · Demo question bank
-- ----------------------------------------------------------------------------
-- DELIBERATELY SMALL. Spec §46/§47: build the engine first, expand the bank
-- through the import tool later. This is 25 questions — five per subject — and
-- exists only so the game loop, scoring and difficulty engine are testable
-- end to end.
--
-- Every row is source_type = 'EDUPASS' and rights_cleared = true. NOTHING here
-- is presented as an official SPM paper. When real past-year or trial content
-- is imported it must carry its own source_type and its own rights_cleared
-- flag, which defaults to false.
--
-- difficulty_score here is ADMIN-assigned, as it must be for a cold bank. The
-- difficulty engine will blend its own estimate in from ~50 attempts onward.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Questions
-- ----------------------------------------------------------------------------
insert into questions (
  code, subject_id, topic_id, form, question_type, stem, explanation,
  difficulty_score, difficulty_label, difficulty_source,
  source_type, source_name, rights_cleared, status
)
select
  q.code, s.id, t.id, q.form, q.qtype, q.stem, q.explanation,
  q.score,
  case when q.score <= 33 then 'EASY' when q.score <= 66 then 'MEDIUM' else 'HARD' end,
  'ADMIN', 'EDUPASS', 'Demo / Practice', true, 'ACTIVE'
from (values
  -- ===================== MATHEMATICS =====================
  ('MATH-D0001','MATH','Quadratic Functions and Equations',4,'MCQ',
   'What are the roots of the quadratic equation x² − 5x + 6 = 0?',
   'Factorise: x² − 5x + 6 = (x − 2)(x − 3). Setting each factor to zero gives x = 2 and x = 3.',
   25),
  ('MATH-D0002','MATH','Number Bases',4,'MCQ',
   'Convert the binary number 1101₂ to base 10.',
   '1101₂ = 1(2³) + 1(2²) + 0(2¹) + 1(2⁰) = 8 + 4 + 0 + 1 = 13.',
   30),
  ('MATH-D0003','MATH','Measures of Dispersion',4,'MCQ',
   'The set of data is 4, 7, 7, 9, 13. What is the interquartile range?',
   'With 5 values, Q1 is the median of the lower half (4, 7) = 5.5 and Q3 is the median of the upper half (9, 13) = 11. IQR = 11 − 5.5 = 5.5.',
   62),
  ('MATH-D0004','MATH','Consumer Mathematics',4,'MCQ',
   'A shirt priced at RM80 is offered at a 15% discount. What is the selling price?',
   'Discount = 15% × RM80 = RM12. Selling price = RM80 − RM12 = RM68.',
   20),
  ('MATH-D0005','MATH','Matrices',5,'MCQ',
   'Given matrix A = (3 1; 2 4), what is the determinant of A?',
   'For a 2×2 matrix (a b; c d), the determinant is ad − bc = (3)(4) − (1)(2) = 12 − 2 = 10.',
   45),

  -- ===================== SCIENCE =====================
  ('SCI-D0001','SCIENCE','Electricity and Magnetism',4,'MCQ',
   'A resistor of 10 Ω carries a current of 2 A. What is the potential difference across it?',
   'By Ohm''s law, V = IR = 2 A × 10 Ω = 20 V.',
   28),
  ('SCI-D0002','SCIENCE','Heredity and Variation',4,'MCQ',
   'Which of the following best describes a gene?',
   'A gene is a segment of DNA that carries the instructions for a particular characteristic. Chromosomes are the structures that carry many genes.',
   35),
  ('SCI-D0003','SCIENCE','Light and Optics',4,'MCQ',
   'An object is placed 30 cm from a converging lens of focal length 10 cm. What is the image distance?',
   'Using 1/f = 1/u + 1/v: 1/10 = 1/30 + 1/v, so 1/v = 1/10 − 1/30 = 2/30, giving v = 15 cm.',
   72),
  ('SCI-D0004','SCIENCE','Carbon Compounds',5,'TRUE_FALSE',
   'Ethanol can be produced from glucose through the process of fermentation.',
   'True. Yeast converts glucose to ethanol and carbon dioxide in the absence of oxygen.',
   22),
  ('SCI-D0005','SCIENCE','Motion and Force',5,'MCQ',
   'A car accelerates uniformly from rest to 20 m/s in 5 s. What is its acceleration?',
   'a = (v − u)/t = (20 − 0)/5 = 4 m/s².',
   26),

  -- ===================== BAHASA MELAYU =====================
  ('BM-D0001','BM','Peribahasa dan Simpulan Bahasa',4,'MCQ',
   'Apakah maksud peribahasa "bagai aur dengan tebing"?',
   '"Bagai aur dengan tebing" bermaksud hubungan yang saling bantu-membantu dan bergantung antara satu sama lain.',
   30),
  ('BM-D0002','BM','Tatabahasa: Kata dan Frasa',4,'MCQ',
   'Pilih ayat yang menggunakan kata sendi nama dengan betul.',
   'Kata sendi "di" digunakan untuk tempat, manakala "pada" digunakan untuk masa, orang dan benda abstrak.',
   42),
  ('BM-D0003','BM','Kesalahan Bahasa',4,'MCQ',
   'Kenal pasti ayat yang mengandungi kesalahan penggunaan imbuhan.',
   'Imbuhan "meN-" berubah mengikut huruf pertama kata dasar. "Mensyukuri" adalah betul kerana kata dasar bermula dengan huruf "s" yang tidak digugurkan bagi kata pinjaman.',
   58),
  ('BM-D0004','BM','Tatabahasa: Ayat',4,'MCQ',
   'Ayat manakah yang merupakan ayat pasif?',
   'Ayat pasif menekankan objek yang menerima perbuatan, biasanya menggunakan imbuhan "di-" pada kata kerja.',
   38),
  ('BM-D0005','BM','Komsas: Puisi dan Sajak',5,'MCQ',
   'Dalam pantun, apakah fungsi dua baris pertama?',
   'Dua baris pertama dalam pantun empat kerat ialah pembayang maksud, yang membina rima dan gambaran sebelum maksud sebenar disampaikan pada dua baris terakhir.',
   32),

  -- ===================== ENGLISH =====================
  ('ENG-D0001','ENGLISH','Grammar: Subject-Verb Agreement',4,'MCQ',
   'Choose the sentence with correct subject-verb agreement.',
   'When a sentence begins with "Neither ... nor", the verb agrees with the subject nearest to it.',
   45),
  ('ENG-D0002','ENGLISH','Grammar: Tenses',4,'MCQ',
   'Select the correct form: "By the time we arrived, the film ___ already."',
   'The past perfect ("had started") is used for an action completed before another past action.',
   40),
  ('ENG-D0003','ENGLISH','Idioms and Phrasal Verbs',5,'MCQ',
   'What does the idiom "to bite the bullet" mean?',
   '"To bite the bullet" means to force yourself to endure a painful or unpleasant situation that is unavoidable.',
   35),
  ('ENG-D0004','ENGLISH','Prepositions and Connectors',4,'MCQ',
   'Choose the correct preposition: "She has been living ___ Kuala Lumpur since 2019."',
   '"In" is used with cities, countries and other enclosed or bounded areas.',
   18),
  ('ENG-D0005','ENGLISH','Reading Comprehension',4,'MCQ',
   'A writer states: "The proposal, though ambitious, rests on assumptions few would accept." What is the writer''s attitude towards the proposal?',
   'The concession "though ambitious" followed by a criticism of its assumptions signals scepticism rather than outright hostility or support.',
   68),

  -- ===================== SEJARAH =====================
  ('SEJ-D0001','SEJARAH','Kemerdekaan Negara',5,'MCQ',
   'Pada tarikh manakah Persekutuan Tanah Melayu mencapai kemerdekaan?',
   'Persekutuan Tanah Melayu mencapai kemerdekaan pada 31 Ogos 1957, diisytiharkan oleh Tunku Abdul Rahman di Stadium Merdeka.',
   15),
  ('SEJ-D0002','SEJARAH','Pembentukan Malaysia',5,'MCQ',
   'Negeri manakah yang menyertai pembentukan Malaysia pada 16 September 1963 tetapi keluar pada tahun 1965?',
   'Singapura menyertai Malaysia pada 16 September 1963 dan berpisah pada 9 Ogos 1965.',
   28),
  ('SEJ-D0003','SEJARAH','Malayan Union dan Persekutuan Tanah Melayu',5,'MCQ',
   'Apakah sebab utama penentangan orang Melayu terhadap Malayan Union?',
   'Penentangan berpunca daripada pengurangan kuasa Raja-Raja Melayu dan pemberian kerakyatan secara jus soli yang dianggap mengancam kedudukan orang Melayu.',
   55),
  ('SEJ-D0004','SEJARAH','Warisan Kesultanan Melayu Melaka',4,'MCQ',
   'Siapakah pengasas Kesultanan Melayu Melaka?',
   'Parameswara mengasaskan Melaka sekitar tahun 1400 selepas berundur dari Palembang dan Temasik.',
   20),
  ('SEJ-D0005','SEJARAH','Perkembangan Nasionalisme',4,'TRUE_FALSE',
   'Kesatuan Melayu Muda (KMM) ditubuhkan dengan matlamat mencapai kemerdekaan melalui kerjasama dengan British.',
   'Salah. KMM menentang penjajahan British dan bercita-cita menyatukan Tanah Melayu dengan Indonesia (Melayu Raya).',
   60)
) as q(code, subject_code, topic_name, form, qtype, stem, explanation, score)
join subjects s on s.code = q.subject_code
left join topics t on t.subject_id = s.id and t.name = q.topic_name
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- Options
-- ----------------------------------------------------------------------------
insert into question_options (question_id, label, content, is_correct, sort_order)
select qq.id, o.label, o.content, o.correct, o.ord
from (values
  ('MATH-D0001','A','x = 2 and x = 3',   true, 1),
  ('MATH-D0001','B','x = −2 and x = −3', false,2),
  ('MATH-D0001','C','x = 1 and x = 6',   false,3),
  ('MATH-D0001','D','x = 5 and x = 6',   false,4),

  ('MATH-D0002','A','11', false,1),
  ('MATH-D0002','B','13', true, 2),
  ('MATH-D0002','C','14', false,3),
  ('MATH-D0002','D','15', false,4),

  ('MATH-D0003','A','4.0', false,1),
  ('MATH-D0003','B','5.5', true, 2),
  ('MATH-D0003','C','6.0', false,3),
  ('MATH-D0003','D','9.0', false,4),

  ('MATH-D0004','A','RM65', false,1),
  ('MATH-D0004','B','RM68', true, 2),
  ('MATH-D0004','C','RM70', false,3),
  ('MATH-D0004','D','RM72', false,4),

  ('MATH-D0005','A','10', true, 1),
  ('MATH-D0005','B','14', false,2),
  ('MATH-D0005','C','−10',false,3),
  ('MATH-D0005','D','6',  false,4),

  ('SCI-D0001','A','5 V',  false,1),
  ('SCI-D0001','B','12 V', false,2),
  ('SCI-D0001','C','20 V', true, 3),
  ('SCI-D0001','D','0.2 V',false,4),

  ('SCI-D0002','A','A structure made of protein that carries traits', false,1),
  ('SCI-D0002','B','A segment of DNA that codes for a characteristic', true, 2),
  ('SCI-D0002','C','A complete set of chromosomes in a cell',          false,3),
  ('SCI-D0002','D','A type of cell found only in reproductive organs', false,4),

  ('SCI-D0003','A','7.5 cm', false,1),
  ('SCI-D0003','B','15 cm',  true, 2),
  ('SCI-D0003','C','20 cm',  false,3),
  ('SCI-D0003','D','30 cm',  false,4),

  ('SCI-D0004','A','True',  true, 1),
  ('SCI-D0004','B','False', false,2),

  ('SCI-D0005','A','2 m/s²',   false,1),
  ('SCI-D0005','B','4 m/s²',   true, 2),
  ('SCI-D0005','C','5 m/s²',   false,3),
  ('SCI-D0005','D','100 m/s²', false,4),

  ('BM-D0001','A','Hubungan yang saling bantu-membantu',      true, 1),
  ('BM-D0001','B','Perselisihan yang berpanjangan',           false,2),
  ('BM-D0001','C','Perkara yang mustahil dilakukan',          false,3),
  ('BM-D0001','D','Seseorang yang tidak berpendirian tetap',  false,4),

  ('BM-D0002','A','Dia tinggal pada Kuala Lumpur.',           false,1),
  ('BM-D0002','B','Buku itu diletakkan di atas meja.',        true, 2),
  ('BM-D0002','C','Mereka bertemu di hari Isnin.',            false,3),
  ('BM-D0002','D','Surat itu dihantar di ayahnya.',           false,4),

  ('BM-D0003','A','Kami mensyukuri nikmat yang diterima.',    false,1),
  ('BM-D0003','B','Dia mempelajari bahasa Jepun.',            false,2),
  ('BM-D0003','C','Pelajar itu mentaati arahan guru.',        true, 3),
  ('BM-D0003','D','Kerajaan mengumumkan dasar baharu.',       false,4),

  ('BM-D0004','A','Ali membaca buku itu.',                    false,1),
  ('BM-D0004','B','Buku itu dibaca oleh Ali.',                true, 2),
  ('BM-D0004','C','Ali sedang membaca di perpustakaan.',      false,3),
  ('BM-D0004','D','Bacalah buku itu, Ali.',                   false,4),

  ('BM-D0005','A','Menyampaikan maksud sebenar',              false,1),
  ('BM-D0005','B','Membina pembayang maksud',                 true, 2),
  ('BM-D0005','C','Memberikan kesimpulan cerita',             false,3),
  ('BM-D0005','D','Menyatakan nama penulis',                  false,4),

  ('ENG-D0001','A','Neither the teacher nor the students was ready.',  false,1),
  ('ENG-D0001','B','Neither the students nor the teacher was ready.',  true, 2),
  ('ENG-D0001','C','Neither the students nor the teacher were ready.', false,3),
  ('ENG-D0001','D','Neither the teacher or the students were ready.',  false,4),

  ('ENG-D0002','A','has started',  false,1),
  ('ENG-D0002','B','started',      false,2),
  ('ENG-D0002','C','had started',  true, 3),
  ('ENG-D0002','D','was starting', false,4),

  ('ENG-D0003','A','To speak without thinking',                   false,1),
  ('ENG-D0003','B','To endure something painful but unavoidable', true, 2),
  ('ENG-D0003','C','To act with unnecessary aggression',          false,3),
  ('ENG-D0003','D','To make a costly mistake',                    false,4),

  ('ENG-D0004','A','at', false,1),
  ('ENG-D0004','B','on', false,2),
  ('ENG-D0004','C','in', true, 3),
  ('ENG-D0004','D','to', false,4),

  ('ENG-D0005','A','Enthusiastic support', false,1),
  ('ENG-D0005','B','Complete indifference',false,2),
  ('ENG-D0005','C','Reasoned scepticism',  true, 3),
  ('ENG-D0005','D','Open hostility',       false,4),

  ('SEJ-D0001','A','31 Ogos 1957',    true, 1),
  ('SEJ-D0001','B','16 September 1963',false,2),
  ('SEJ-D0001','C','31 Ogos 1963',    false,3),
  ('SEJ-D0001','D','1 Februari 1948', false,4),

  ('SEJ-D0002','A','Sarawak',   false,1),
  ('SEJ-D0002','B','Sabah',     false,2),
  ('SEJ-D0002','C','Singapura', true, 3),
  ('SEJ-D0002','D','Brunei',    false,4),

  ('SEJ-D0003','A','Kerana cukai yang terlalu tinggi dikenakan',            false,1),
  ('SEJ-D0003','B','Kerana kuasa Raja-Raja Melayu dikurangkan dan kerakyatan jus soli diperkenalkan', true, 2),
  ('SEJ-D0003','C','Kerana bahasa Inggeris dijadikan bahasa rasmi tunggal', false,3),
  ('SEJ-D0003','D','Kerana Tanah Melayu digabungkan dengan Indonesia',      false,4),

  ('SEJ-D0004','A','Sultan Mansur Shah', false,1),
  ('SEJ-D0004','B','Parameswara',        true, 2),
  ('SEJ-D0004','C','Tun Perak',          false,3),
  ('SEJ-D0004','D','Sultan Muzaffar Shah',false,4),

  ('SEJ-D0005','A','Benar', false,1),
  ('SEJ-D0005','B','Salah', true, 2)
) as o(qcode, label, content, correct, ord)
join questions qq on qq.code = o.qcode
on conflict (question_id, label) do nothing;

-- ----------------------------------------------------------------------------
-- Daily Challenges for the season
-- ----------------------------------------------------------------------------
-- Generates one challenge row per subject per day across the whole campaign,
-- so the mode is playable from 1 September without an admin having to create
-- anything by hand. Question sets are attached by the scheduler function below
-- as each day opens, which keeps the set unpredictable ahead of time.
insert into daily_challenges (season_id, subject_id, challenge_date, question_count, status)
select s.id, sub.id, d::date, 10, 'SCHEDULED'
from seasons s
cross join generate_series(s.starts_on, s.ends_on, interval '1 day') d
cross join subjects sub
where s.code = 'SPM_GAMES_2026_S1' and sub.is_active
on conflict (season_id, subject_id, challenge_date) do nothing;

-- ----------------------------------------------------------------------------
-- Daily Challenge question scheduler
-- ----------------------------------------------------------------------------
/**
 * Attaches a fixed, identical question set to every Daily Challenge opening on
 * the given date, then marks them OPEN.
 *
 * The set is deliberately NOT adaptive: a leaderboard built on differing
 * question sets is not a fair comparison, so every student in Malaysia sees
 * the same ten questions in the same order on the same day (spec §10).
 *
 * Run once per day, shortly after midnight MYT.
 */
create or replace function open_daily_challenges(p_date date default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_date  date := coalesce(p_date, my_today());
  v_row   record;
  v_count integer := 0;
begin
  for v_row in
    select dc.id, dc.subject_id, dc.question_count
    from daily_challenges dc
    where dc.challenge_date = v_date and dc.status = 'SCHEDULED'
  loop
    insert into daily_challenge_questions (daily_challenge_id, question_id, position)
    select v_row.id, q.id, row_number() over ()
    from (
      select id from questions
      where subject_id = v_row.subject_id and status = 'ACTIVE'
      -- A stable per-day shuffle: same set for everyone, different each day,
      -- and not guessable from the previous day's set.
      order by md5(id::text || v_date::text)
      limit v_row.question_count
    ) q
    on conflict do nothing;

    update daily_challenges set status = 'OPEN' where id = v_row.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;
