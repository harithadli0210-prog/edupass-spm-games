-- ============================================================================
-- Seed 0001 · Reference data
-- Season, states, districts, subjects, topics, level thresholds.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Season (spec §40 — 2026 is data, never a constant in code)
-- ----------------------------------------------------------------------------
insert into seasons (code, name, starts_on, ends_on, status) values
  ('SPM_GAMES_2026_S1', 'SPM Games 2026 — Season 1', '2026-09-01', '2026-10-31', 'ACTIVE')
on conflict (code) do update set
  name = excluded.name, starts_on = excluded.starts_on, ends_on = excluded.ends_on;

-- ----------------------------------------------------------------------------
-- States — 13 states + 3 federal territories
-- ----------------------------------------------------------------------------
insert into states (code, name) values
  ('JHR','Johor'), ('KDH','Kedah'), ('KTN','Kelantan'), ('MLK','Melaka'),
  ('NSN','Negeri Sembilan'), ('PHG','Pahang'), ('PNG','Pulau Pinang'),
  ('PRK','Perak'), ('PLS','Perlis'), ('SBH','Sabah'), ('SWK','Sarawak'),
  ('SGR','Selangor'), ('TRG','Terengganu'),
  ('KUL','W.P. Kuala Lumpur'), ('LBN','W.P. Labuan'), ('PJY','W.P. Putrajaya')
on conflict (code) do update set name = excluded.name;

-- ----------------------------------------------------------------------------
-- Districts (PPD). Abridged to the main districts per state for the MVP; the
-- admin import tool loads the complete MOE list before launch.
-- ----------------------------------------------------------------------------
insert into districts (state_id, name)
select s.id, d.name from states s
join (values
  ('JHR','Johor Bahru'),('JHR','Batu Pahat'),('JHR','Kluang'),('JHR','Muar'),
  ('JHR','Segamat'),('JHR','Kota Tinggi'),('JHR','Pontian'),('JHR','Kulai'),
  ('JHR','Mersing'),('JHR','Tangkak'),
  ('KDH','Kota Setar'),('KDH','Kubang Pasu'),('KDH','Kuala Muda'),('KDH','Kulim'),
  ('KDH','Baling'),('KDH','Langkawi'),('KDH','Sik'),('KDH','Yan'),('KDH','Padang Terap'),
  ('KTN','Kota Bharu'),('KTN','Pasir Mas'),('KTN','Tumpat'),('KTN','Bachok'),
  ('KTN','Machang'),('KTN','Tanah Merah'),('KTN','Kuala Krai'),('KTN','Gua Musang'),
  ('MLK','Melaka Tengah'),('MLK','Alor Gajah'),('MLK','Jasin'),
  ('NSN','Seremban'),('NSN','Port Dickson'),('NSN','Jempol'),('NSN','Kuala Pilah'),
  ('NSN','Rembau'),('NSN','Tampin'),('NSN','Jelebu'),
  ('PHG','Kuantan'),('PHG','Temerloh'),('PHG','Bentong'),('PHG','Pekan'),
  ('PHG','Raub'),('PHG','Jerantut'),('PHG','Bera'),('PHG','Rompin'),
  ('PHG','Lipis'),('PHG','Maran'),('PHG','Cameron Highlands'),
  ('PNG','Timur Laut'),('PNG','Barat Daya'),('PNG','Seberang Perai Utara'),
  ('PNG','Seberang Perai Tengah'),('PNG','Seberang Perai Selatan'),
  ('PRK','Kinta'),('PRK','Larut Matang dan Selama'),('PRK','Manjung'),
  ('PRK','Kerian'),('PRK','Hilir Perak'),('PRK','Batang Padang'),
  ('PRK','Kuala Kangsar'),('PRK','Perak Tengah'),('PRK','Hulu Perak'),
  ('PLS','Perlis'),
  ('SBH','Kota Kinabalu'),('SBH','Sandakan'),('SBH','Tawau'),('SBH','Penampang'),
  ('SBH','Papar'),('SBH','Keningau'),('SBH','Lahad Datu'),('SBH','Semporna'),
  ('SBH','Kudat'),('SBH','Beaufort'),('SBH','Ranau'),('SBH','Tuaran'),
  ('SWK','Kuching'),('SWK','Miri'),('SWK','Sibu'),('SWK','Bintulu'),
  ('SWK','Samarahan'),('SWK','Sri Aman'),('SWK','Kapit'),('SWK','Limbang'),
  ('SWK','Sarikei'),('SWK','Betong'),('SWK','Mukah'),
  ('SGR','Petaling'),('SGR','Klang'),('SGR','Hulu Langat'),('SGR','Gombak'),
  ('SGR','Sepang'),('SGR','Kuala Langat'),('SGR','Kuala Selangor'),
  ('SGR','Sabak Bernam'),('SGR','Hulu Selangor'),
  ('TRG','Kuala Terengganu'),('TRG','Kemaman'),('TRG','Dungun'),('TRG','Besut'),
  ('TRG','Marang'),('TRG','Hulu Terengganu'),('TRG','Setiu'),
  ('KUL','Bangsar Pudu'),('KUL','Keramat'),('KUL','Sentul'),('KUL','Kepong'),
  ('KUL','Cheras'),
  ('LBN','Labuan'),
  ('PJY','Putrajaya')
) as d(state_code, name) on d.state_code = s.code
on conflict (state_id, name) do nothing;

-- ----------------------------------------------------------------------------
-- Subjects (spec §9). Five active for the MVP; the two future subjects are
-- seeded inactive so adding them later is a flag flip, not a migration.
-- ----------------------------------------------------------------------------
insert into subjects (code, name_en, name_ms, icon, sort_order, is_active) values
  ('BM',      'Bahasa Melayu', 'Bahasa Melayu', 'BM',      1, true),
  ('ENGLISH', 'English',       'Bahasa Inggeris','ENGLISH', 2, true),
  ('MATH',    'Mathematics',   'Matematik',     'MATH',    3, true),
  ('SCIENCE', 'Science',       'Sains',         'SCIENCE', 4, true),
  ('SEJARAH', 'History',       'Sejarah',       'SEJARAH', 5, true),
  ('PENDIDIKAN_ISLAM', 'Islamic Education', 'Pendidikan Islam', 'PENDIDIKAN_ISLAM', 6, false),
  ('PENDIDIKAN_MORAL', 'Moral Education',   'Pendidikan Moral', 'PENDIDIKAN_MORAL', 7, false)
on conflict (code) do update set
  name_en = excluded.name_en, name_ms = excluded.name_ms,
  icon = excluded.icon, sort_order = excluded.sort_order;

-- ----------------------------------------------------------------------------
-- Topics — the KSSM chapter structure, which also seeds the Mission list later.
-- ----------------------------------------------------------------------------
insert into topics (subject_id, name, form, sort_order)
select s.id, t.name, t.form, t.ord from subjects s
join (values
  ('MATH','Quadratic Functions and Equations',4,1),
  ('MATH','Number Bases',4,2),
  ('MATH','Logical Reasoning',4,3),
  ('MATH','Operations on Sets',4,4),
  ('MATH','Network in Graph Theory',4,5),
  ('MATH','Linear Inequalities in Two Variables',4,6),
  ('MATH','Graphs of Motion',4,7),
  ('MATH','Measures of Dispersion',4,8),
  ('MATH','Probability of Combined Events',4,9),
  ('MATH','Consumer Mathematics',4,10),
  ('MATH','Variation',5,11),
  ('MATH','Matrices',5,12),
  ('MATH','Insurance and Taxation',5,13),
  ('MATH','Congruency, Enlargement and Combined Transformations',5,14),
  ('MATH','Ratios and Graphs of Trigonometric Functions',5,15),

  ('SCIENCE','Scientific Investigation',4,1),
  ('SCIENCE','Body Coordination',4,2),
  ('SCIENCE','Heredity and Variation',4,3),
  ('SCIENCE','Growth in Plants',4,4),
  ('SCIENCE','Transport in Plants',4,5),
  ('SCIENCE','Electricity and Magnetism',4,6),
  ('SCIENCE','Nuclear Energy',4,7),
  ('SCIENCE','Light and Optics',4,8),
  ('SCIENCE','Waves',5,9),
  ('SCIENCE','Chemicals in Industry',5,10),
  ('SCIENCE','Carbon Compounds',5,11),
  ('SCIENCE','Motion and Force',5,12),
  ('SCIENCE','Space Exploration',5,13),

  ('BM','Pemahaman Petikan',4,1),
  ('BM','Tatabahasa: Kata dan Frasa',4,2),
  ('BM','Tatabahasa: Ayat',4,3),
  ('BM','Peribahasa dan Simpulan Bahasa',4,4),
  ('BM','Kesalahan Bahasa',4,5),
  ('BM','Karangan dan Ringkasan',5,6),
  ('BM','Komsas: Prosa Tradisional',5,7),
  ('BM','Komsas: Puisi dan Sajak',5,8),
  ('BM','Komsas: Novel dan Drama',5,9),

  ('ENGLISH','Reading Comprehension',4,1),
  ('ENGLISH','Grammar: Tenses',4,2),
  ('ENGLISH','Grammar: Subject-Verb Agreement',4,3),
  ('ENGLISH','Vocabulary and Word Forms',4,4),
  ('ENGLISH','Prepositions and Connectors',4,5),
  ('ENGLISH','Idioms and Phrasal Verbs',5,6),
  ('ENGLISH','Summary Writing',5,7),
  ('ENGLISH','Literature Components',5,8),

  ('SEJARAH','Kemakmuran dan Kejayaan Tamadun Awal',4,1),
  ('SEJARAH','Warisan Kesultanan Melayu Melaka',4,2),
  ('SEJARAH','Kedatangan Kuasa Barat',4,3),
  ('SEJARAH','Perkembangan Nasionalisme',4,4),
  ('SEJARAH','Pendudukan Jepun di Tanah Melayu',4,5),
  ('SEJARAH','Malayan Union dan Persekutuan Tanah Melayu',5,6),
  ('SEJARAH','Kemerdekaan Negara',5,7),
  ('SEJARAH','Pembentukan Malaysia',5,8),
  ('SEJARAH','Sistem Pentadbiran dan Perlembagaan',5,9),
  ('SEJARAH','Dasar Luar Malaysia',5,10)
) as t(subject_code, name, form, ord) on t.subject_code = s.code
on conflict (subject_id, parent_topic_id, name) do nothing;

-- ----------------------------------------------------------------------------
-- Level thresholds (spec §18). Curve widens as it climbs so early levels come
-- quickly — the first session should produce visible progress — while Level 20
-- remains a genuine two-month goal.
-- ----------------------------------------------------------------------------
insert into level_thresholds (level, xp_required, title) values
  (1,      0, 'Newcomer'),      (2,    500, 'Starter'),
  (3,   1200, 'Learner'),       (4,   2200, 'Learner'),
  (5,   3500, 'Contender'),     (6,   5200, 'Contender'),
  (7,   7300, 'Challenger'),    (8,   9800, 'Challenger'),
  (9,  12800, 'Achiever'),      (10, 16300, 'Achiever'),
  (11, 20400, 'Specialist'),    (12, 25100, 'Specialist'),
  (13, 30500, 'Expert'),        (14, 36600, 'Expert'),
  (15, 43500, 'Master'),        (16, 51200, 'Master'),
  (17, 59800, 'Elite'),         (18, 69300, 'Elite'),
  (19, 79800, 'Champion'),      (20, 91300, 'Champion'),
  (21,103900, 'Legend'),        (22,117600, 'Legend'),
  (23,132500, 'Legend'),        (24,148600, 'Legend'),
  (25,166000, 'Legend')
on conflict (level) do update set
  xp_required = excluded.xp_required, title = excluded.title;
