/**
 * English copy. This file is the source of truth for the shape of the
 * dictionary — ms.ts must satisfy the same type, so a missing Malay string is
 * a build error rather than an English word appearing mid-sentence.
 */
export const en = {
  meta: {
    title: "SPM Games 2026 — EduPass",
    titleTemplate: "%s — SPM Games 2026",
    description:
      "A nationwide SPM challenge for every Malaysian student. Play daily, climb the leaderboard, and discover where your strengths point.",
  },

  common: {
    play: "Play",
    playNow: "Play Now",
    points: "points",
    pts: "pts",
    xp: "XP",
    level: "Level",
    streak: "Streak",
    accuracy: "Accuracy",
    day: "day",
    days: "days",
    questions: "questions",
    answered: "answered",
    correct: "correct",
    subject: "Subject",
    subjects: "Subjects",
    of: "of",
    viewAll: "View all",
    tryAgain: "Try again",
    back: "Back",
    loading: "Loading",
    soon: "Soon",
    adminOnly: "Admin only",
    doneToday: "Done today",
    seconds: "seconds",
    unlimited: "unlimited",
    mastery: "mastery",
    players: "players",
  },

  nav: {
    myDesk: "My Desk",
    compete: "Compete",
    support: "Support",
    dashboard: "Dashboard",
    progress: "My Progress",
    miniGames: "Mini Games",
    leaderboard: "Leaderboard",
    prizes: "Prizes",
    help: "Help Center",
    home: "Home",
    ranking: "Ranking",
    backToGame: "Back to game",
    upsellTitle: "Ready for what's next?",
    upsellBody:
      "Complete your EduPass profile to see courses matched to how you play.",
    upsellCta: "Explore courses",
  },

  hero: {
    inPrizes: "in prizes",
    seasonBadge: "SPM Games 2026 · Season 1",
    headline: "Play, climb the ranks, win real prizes.",
    sub: "{days} days left this season, {name}. Every round you play counts towards your Malaysia ranking.",
    playToday: "Play today's challenge",
    viewPrizes: "View prizes",
  },

  dashboard: {
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    fullProgress: "Full progress",
    allModes: "All modes",
    malaysiaRank: "Malaysia rank",
    ofPlayers: "of {total} players nationwide",
    playToGetRanked: "Play a round to get ranked",
    overall: "Overall",
    performance: "Performance",
    performanceEmpty: "Play a round in each subject to fill this in.",
    miniGames: "Mini Games",
    dailySubtitle: "Daily Challenge · {done} of {total} subjects done today",
    prizesTitle: "What you're playing for",
    prizesSubtitle: "RM {pool} across {count} categories this season.",
    allPrizes: "All prizes",
    prizesEmptyTitle: "Prizes not announced yet",
    prizesEmptyBody:
      "Prize details for this season will appear here once confirmed.",
    topOfMalaysia: "Top of Malaysia",
    fullRanking: "Full ranking",
    you: "You",
    pointsToTop100: "points to reach the Top 100",
    subjectMastery: "Subject mastery",
    masteryEmptyTitle: "No subject data yet",
    masteryEmptyBody:
      "Play a round in any subject and your mastery starts building here.",
    xpToNext: "{xp} XP to level {level}",
  },

  play: {
    chooseMode: "Choose a mode",
    chooseModeSub:
      "Daily and Speedy have their own leaderboards. Both feed your overall rank.",
    daily: "Daily Challenge",
    dailyBlurb: "10 questions per subject, every day. Points build all season.",
    dailyTitle: "Daily Challenge",
    dailySub:
      "Ten questions per subject. Everyone in Malaysia gets the same set today, so the ranking is a fair comparison.",
    dailyMeta: "10 questions · once a day",
    speed: "Speedy Challenge",
    speedBlurb:
      "60 seconds. Answer as many as you can — accuracy still counts.",
    speedTitle: "Speedy Challenge",
    speedSub:
      "Sixty seconds, as many questions as you can. Play as often as you like — there is no daily limit.",
    speedMeta: "60 seconds · unlimited",
    mission: "Subject Missions",
    missionBlurb: "Work through a subject topic by topic.",
    boss: "Weekly Boss",
    bossBlurb: "One subject, 20 questions, rising difficulty.",
    scoringTitle: "How the score works",
    scoring1: "Faster correct answers earn a bigger speed bonus.",
    scoring2: "Harder questions are worth more.",
    scoring3: "Wrong answers cost points.",
    scoring4:
      "Your round total is scaled by accuracy — answering 100 questions badly will not beat answering 20 well.",
    allDoneTitle:
      "All five subjects done for today. New questions unlock at midnight — or play Speedy Challenge now, it has no daily limit.",
  },

  game: {
    question: "Question",
    points: "Points",
    correct: "Correct",
    notQuite: "Not quite",
    speed: "speed",
    endEarly: "End round early",
    starting: "Starting",
    roundScore: "Round score",
    avgTime: "Avg time",
    playAgain: "Play again",
    backHome: "Back to home",
    levelUp: "Level {level}",
    levelUpBody: "You levelled up from {from}.",
    correctOf: "{correct} correct of {answered}",
    accuracyMultiplier: "Accuracy multiplier ×{factor}",
    completionBonus: "Completion bonus",
    total: "Total",
    gateNote:
      "Your round total is scaled by accuracy, so answering carefully is worth more than answering quickly. Getting more right lifts the multiplier.",
    errorTitle: "The round hit a problem",
  },

  leaderboard: {
    title: "Leaderboard",
    yourPosition: "Your position",
    nobodyRanked: "Nobody ranked yet",
    beFirst: "Be the first — play a round and you're on the board.",
    improvedEmpty:
      "This board opens once students have a full record in both September and October.",
    noSchools: "No schools ranked yet",
    noSchoolsBody:
      "Schools appear here once enough of their students have played.",
    tabs: {
      overall: "Overall",
      daily: "Daily",
      speed: "Speedy",
      subject: "Subjects",
      school: "Schools",
      consistency: "Consistency",
      improved: "Most Improved",
    },
    blurbs: {
      overall: "Daily and Speedy combined, weighted. The headline competition.",
      daily: "Daily Challenge points only, accumulated across the season.",
      speed: "Speedy Challenge points only, accumulated across the season.",
      subject: "Best in each subject.",
      school: "Ranked by average score, so a big school has no advantage.",
      consistency:
        "Rewards showing up regularly, not playing the most hours.",
      improved:
        "Biggest genuine improvement from September to October. Needs a real record in both months to qualify.",
    },
  },

  performance: {
    title: "My performance",
    sub: "How you're doing this season, and where the gaps are.",
    overallScore: "Overall score",
    avgResponse: "Avg response",
    activeDays: "{days} active days",
    accuracyOverTime: "Accuracy over time",
    accuracyOverTimeSub: "Each point is one day of play.",
    notEnoughDays: "Not enough days yet",
    notEnoughDaysBody:
      "Play on at least two different days and your trend appears here.",
    playARound: "Play a round",
    byDifficulty: "By difficulty",
    byDifficultySub: "Where your accuracy holds up, and where it drops.",
    noQuestions: "No questions answered yet",
    noQuestionsBody:
      "This breaks down how you do on easy, medium and hard questions.",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  },

  prizes: {
    title: "Prizes",
    poolBadge: "Season 1 prize pool",
    poolSub:
      "Spread across {count} categories. Every category has its own leaderboard, so there is more than one way to win.",
    mainCategories: "Main categories",
    subjectChampions: "Subject champions",
    subjectChampionsSub:
      "One set of prizes for each of the five SPM subjects.",
    firstPlace: "1st place",
    sponsoredBy: "Sponsored by",
    disclaimer:
      "Prizes are indicative and may be substituted for items of equal or greater value. Winners are determined by the final season leaderboards on 31 October 2026 and verified before any prize is awarded.",
  },

  insights: {
    title: "What we're learning about you",
    sub: "Based on how you've played so far.",
    stillWatching: "Still watching",
    stillWatchingBody:
      "A few more rounds and your playing patterns will start showing up here.",
    playFirst: "Play a few rounds first",
    playFirstBody:
      "Once you've played, this is where we'll show what your answers suggest about how you learn.",
    signals: {
      FAST_THINKER: {
        label: "Fast thinker",
        note: "You answer noticeably quicker than most players.",
      },
      CAREFUL_RESPONDER: {
        label: "Careful responder",
        note: "You take your time and it shows in your accuracy.",
      },
      ANALYTICAL: {
        label: "Analytical",
        note: "You do well on questions that need working out.",
      },
      DIFFICULTY_TOLERANT: {
        label: "Handles hard questions",
        note: "Your accuracy holds up on the toughest questions.",
      },
      PRESSURE_PERFORMER: {
        label: "Strong under time pressure",
        note: "Your accuracy stays high in timed rounds.",
      },
      MATHEMATICAL_STRONG: {
        label: "Strong in Mathematics",
        note: "Mathematics is among your best subjects.",
      },
      SCIENCE_STRONG: {
        label: "Strong in Science",
        note: "Science is among your best subjects.",
      },
      LANGUAGE_STRONG: {
        label: "Strong in languages",
        note: "You perform well across BM and English.",
      },
      CONSISTENT: {
        label: "Consistent",
        note: "You show up and play regularly.",
      },
      PERSISTENT: {
        label: "Persistent",
        note: "You come back to topics until they click.",
      },
    },
  },

  studyAreas: {
    title: "You might enjoy exploring",
    emptyTitle: "Not enough to go on yet",
    emptyBody:
      "Play across a few subjects and we'll suggest study areas worth a look.",
    disclaimer:
      "Based on your current game behaviour. These are places to look, not a recommendation about your future — your interests and full academic profile matter more than a quiz.",
    cta: "Complete your EduPass profile for better matches →",
  },

  auth: {
    joinTitle: "Join SPM Games 2026",
    joinSub:
      "Free to enter, open to every SPM student in Malaysia. Sign in with your email to start playing.",
    privacyNote:
      "Your email signs you in. We ask for a phone number later, only to keep the competition fair by preventing duplicate accounts. Neither is ever shown on a leaderboard.",
    mobileNumber: "Mobile number",
    mobileHint: "We'll text you a 6-digit code.",
    sendCode: "Send link",
    verificationCode: "Verification code",
    sentTo: "Sent to {phone}",
    verifyContinue: "Verify and continue",
    differentNumber: "Use a different number",
    badPhone: "Enter a Malaysian mobile number, e.g. 012-345 6789.",
    badCode: "That code didn't work. Check it and try again.",
    emailLabel: "Email address",
    emailHint: "We'll email you a sign-in link.",
    sentToEmail: "Sent to {email}",
    usePhone: "Use phone instead",
    useEmail: "Use email instead",
    badEmail: "Enter a valid email address.",
    orDivider: "or",
    orClickLink:
      "No code in the email? Click the link in it instead — that signs you in too.",
    linkExpired: "That link has expired. Ask for a new one.",
    checkInbox: "Check your inbox",
    checkInboxBody:
      "We sent a sign-in link to {email}. Open it on this device and you are in.",
    checkInboxHint:
      "Nothing after a minute? Look in spam, or send it again.",
    sendAgain: "Send it again",
    sentAgain: "Sent. Check your inbox.",
    useAnotherEmail: "Use a different email",
  },

  onboarding: {
    title: "Your details",
    sub: "Eight quick fields, then you can play. We need these to place you on the school and state leaderboards.",
    fullName: "Full name",
    fullNameHint: "As it appears on your IC.",
    displayName: "Display name",
    displayNameHint: "This is the only name shown on leaderboards.",
    phone: "Phone number",
    email: "Email",
    schoolName: "School name",
    schoolHint: "Write it out in full, e.g. SMK Taman Melawati.",
    state: "State",
    chooseState: "Choose your state",
    district: "District / City",
    chooseDistrict: "Choose your district",
    districtHint: "Choose your state first.",
    postcode: "Postcode",
    consent:
      "I agree to EduPass storing these details to run SPM Games 2026 and to place me on the competition leaderboards.",
    guardianConsent:
      "I am under 18 and my parent or guardian has agreed to my taking part.",
    submit: "Start playing",
    saveError: "Could not save your details.",
  },

  help: {
    title: "Help Center",
    sub: "How scoring, ranking and prizes work.",
    stillStuck: "Still stuck? Email {email} and we'll get back to you.",
    faqs: [
      {
        q: "How is my score calculated?",
        a: "Every correct answer earns base points, multiplied by how hard the question is. In Speedy Challenge, faster answers earn a bonus on top. At the end of a round your total is scaled by your accuracy, so answering carefully is worth more than answering quickly.",
      },
      {
        q: "Why did my Speedy score drop after answering more questions?",
        a: "Wrong answers cost points, and your round total is multiplied by an accuracy factor. Answering 100 questions badly will not beat answering 20 well — that is deliberate, so the leaderboard rewards understanding rather than tapping.",
      },
      {
        q: "Can I play the Daily Challenge more than once?",
        a: "Once per subject per day, and everyone in Malaysia gets the same ten questions, so the Daily leaderboard is a fair comparison. Speedy Challenge has no daily limit.",
      },
      {
        q: "How are Daily and Speedy scores combined?",
        a: "They are not — each has its own leaderboard and its own prizes. Your Overall rank combines them using a published weighting, after normalising each mode so neither one dominates just because it produces bigger numbers.",
      },
      {
        q: "What counts for the Consistency award?",
        a: "Active days, how many Daily Challenges you complete, and your longest streak. Total hours played is deliberately excluded — it rewards showing up regularly, not grinding.",
      },
      {
        q: "Who can see my details?",
        a: "Leaderboards show only your display name, school and state. Your phone number, email and postcode are never shown publicly and are not readable by other students.",
      },
    ],
  },

  policy: {
    rules: "Competition Rules",
    privacy: "Privacy Notice",
    contact: "Questions? Email",
    consentPrefix: "I agree to the",
    consentRules: "Competition Rules",
    consentAnd: "and the",
    consentPrivacy: "Privacy Notice",
    consentSuffix: ", and to EduPass storing my details to run SPM Games 2026.",
    draftWarning:
      "Draft — not yet reviewed by a legal adviser. Do not publish to students in this state.",
  },

  errors: {
    somethingWrong: "Something went wrong",
    couldNotLoad:
      "We couldn't load this just now. Check your connection and try again.",
    notSignedIn: "Not signed in.",
    couldNotStart: "Could not start the round.",
    couldNotRecord: "Could not record your answer.",
    couldNotFinish: "Could not finish the round.",
    tooManyRounds:
      "Too many rounds started. Take a breath and try again shortly.",
    slowDown: "Slow down.",
    noQuestions: "No questions are available for this subject yet.",
    modeUnavailable: "This game mode is not available yet.",
    seasonClosed: "The season is not open.",
    profileFirst: "Complete your profile first.",
    alreadyPlayed:
      "You've already played today's challenge for this subject.",
    inProgress: "You already have this challenge in progress.",
    challengeNotOpen: "Today's challenge isn't open yet.",
    timesUp: "Time's up.",
    roundFinished: "This round is already finished.",
  },
};

/**
 * No `as const`: it would make every English string a literal type, and ms.ts
 * could then never satisfy the same shape. Structure is enforced; wording is
 * free.
 */
export type Dictionary = typeof en;
