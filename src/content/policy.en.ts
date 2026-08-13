/**
 * Competition rules and privacy notice — English.
 *
 * Written to be read by a seventeen-year-old and by their parent, which mostly
 * means short sentences and no defensive padding. Where a rule exists to
 * protect the student rather than the organiser, it says so.
 *
 * NOT LEGAL ADVICE. This is a solid draft, but it must be reviewed by someone
 * qualified before it is published — particularly the privacy notice, since
 * participants are minors and the PDPA 2010 obligations around consent and
 * cross-border transfer are specific.
 */

export interface PolicySection {
  heading: string;
  body: string[];
  list?: string[];
}

export interface PolicyDoc {
  title: string;
  intro: string;
  updated: string;
  sections: PolicySection[];
}

export const rulesEn: PolicyDoc = {
  title: "Competition Rules",
  intro:
    "These are the rules for SPM Games 2026, Season 1, running from 1 September to 31 October 2026. Entering the competition means you accept them.",
  updated: "Effective from",
  sections: [
    {
      heading: "1. Who can enter",
      body: [
        "SPM Games 2026 is open to secondary school students in Malaysia. Entry is free and there is nothing to buy at any point.",
      ],
      list: [
        "You must be at least 13 years old.",
        "If you are under 18, your parent or guardian must agree to your taking part.",
        "Employees of EduPass and their immediate families may play, but are not eligible for prizes.",
      ],
    },
    {
      heading: "2. One account per person",
      body: [
        "You may hold one account. Your phone number identifies you, so the same number cannot be used twice.",
        "If two accounts are found to belong to the same person, the account registered first is kept. The later one loses prize eligibility, and its scores are removed from the leaderboards.",
        "This rule exists so that a student playing honestly is not pushed down the rankings by someone playing several times.",
      ],
    },
    {
      heading: "3. Verifying your phone number",
      body: [
        "You can register and play with your email alone. Verification is only needed if you reach a position where prizes are awarded.",
        "If you reach the top 500 on any leaderboard, we will send a six-digit code to your phone by WhatsApp. Enter it in the app to verify.",
      ],
      list: [
        "You have 7 days to verify after we ask.",
        "The code expires after 10 minutes and you get 5 attempts.",
        "Until you verify, you can keep playing and you stay on the leaderboards — only prize eligibility is paused.",
        "If you no longer use the number you registered, contact us and we will help you change it.",
      ],
    },
    {
      heading: "4. How scoring works",
      body: [
        "Correct answers earn points, multiplied by how difficult the question is. In Speedy Challenge, faster answers earn an additional bonus.",
        "At the end of a round your total is multiplied by your accuracy. Answering many questions carelessly will not beat answering fewer questions well. This is deliberate: the competition rewards understanding, not speed of tapping.",
        "Daily Challenge and Speedy Challenge have separate leaderboards and separate prizes. Your Overall rank combines them using a published weighting, after each mode is normalised so that neither dominates simply because it produces larger numbers.",
        "The full scoring rules are published in the Help Centre and do not change mid-season without notice.",
      ],
    },
    {
      heading: "5. Fair play",
      body: ["The following are not allowed:"],
      list: [
        "Holding or using more than one account.",
        "Using automated tools, scripts or bots of any kind.",
        "Letting another person play on your account, or playing on someone else's.",
        "Sharing answers to a Daily Challenge while it is still open, since every student in Malaysia receives the same questions that day.",
        "Interfering with the service, the scoring, or other participants.",
      ],
    },
    {
      heading: "6. If we think something is wrong",
      body: [
        "Our systems flag unusual activity automatically — for example, answers submitted faster than a person could read the question. A flag is not an accusation, and nothing happens automatically because of one.",
        "Every flagged account is reviewed by a person before any action is taken. If we suspend or disqualify an account, we will tell you why, and you have 7 days to respond.",
        "We would rather investigate a real student and find nothing than remove someone honest from the competition.",
      ],
    },
    {
      heading: "7. Prizes",
      body: [
        "Prizes are listed on the Prizes page. Winners are determined by the final leaderboards at 23:59 on 31 October 2026, after a verification period of up to 14 days.",
      ],
      list: [
        "Prizes are not transferable and cannot be exchanged for cash unless stated.",
        "We may substitute a prize for one of equal or greater value if it becomes unavailable.",
        "You have 30 days from being notified to claim your prize.",
        "Any tax arising from a prize is the recipient's responsibility.",
        "School prizes are paid to the school, not to individual students.",
      ],
    },
    {
      heading: "8. Ties",
      body: [
        "If two students finish on the same score, the tie is broken in this order: higher accuracy, then fewer total questions answered, then earlier registration.",
      ],
    },
    {
      heading: "9. Changes",
      body: [
        "We may change these rules if we need to — for example to close an unforeseen loophole. If we do, we will publish the change and the date it takes effect, and we will not apply it to scores already earned.",
        "If the competition cannot run fairly for reasons outside our control, we may suspend or end it. If that happens we will explain what will happen to prizes.",
      ],
    },
    {
      heading: "10. Contact",
      body: [
        "Questions about these rules, or about a decision affecting your account, go to spmgames@edupass.my. We aim to reply within three working days.",
      ],
    },
  ],
};

export const privacyEn: PolicyDoc = {
  title: "Privacy Notice",
  intro:
    "This explains what EduPass collects when you take part in SPM Games 2026, why, and what control you have. It is written to meet our obligations under Malaysia's Personal Data Protection Act 2010.",
  updated: "Effective from",
  sections: [
    {
      heading: "1. Who is responsible",
      body: [
        "EduPass is responsible for the personal data described here. You can reach us at spmgames@edupass.my.",
      ],
    },
    {
      heading: "2. What we collect",
      body: ["When you register, we ask for:"],
      list: [
        "Your full name",
        "A display name of your choosing",
        "Your phone number",
        "Your email address",
        "Your school, state, district and postcode",
      ],
    },
    {
      heading: "3. What we record as you play",
      body: [
        "As you answer questions we record which question, which answer you chose, whether it was correct, how long you took, and the points earned.",
        "We use this to score the competition, to measure how difficult each question actually is, and to show you your own progress. It is also what allows us to suggest study areas that might interest you.",
      ],
    },
    {
      heading: "4. Why we need it",
      body: ["Each field has a purpose. We do not collect anything we do not use."],
      list: [
        "Name and phone number — to identify you and to make sure nobody enters more than once.",
        "Email — to sign you in and to contact you if you win.",
        "School, state and district — to run the school and state leaderboards.",
        "Postcode — for regional analysis of participation. It is never shown publicly.",
      ],
    },
    {
      heading: "5. What other people can see",
      body: [
        "Leaderboards show only your display name, your school and your state.",
      ],
      list: [
        "Your full name is never shown publicly.",
        "Your phone number is never shown publicly.",
        "Your email address is never shown publicly.",
        "Your postcode is never shown publicly.",
      ],
    },
    {
      heading: "6. Who we share it with",
      body: [
        "We do not sell your data, and we do not share it with advertisers.",
        "We share it only with the service providers who host the platform on our behalf, and only so that it can run. They are not permitted to use it for anything else. Some of them store data outside Malaysia; where that happens we take reasonable steps to ensure comparable protection.",
        "If you win a prize provided by a sponsor, we will share only what is necessary to deliver it, and we will tell you first.",
      ],
    },
    {
      heading: "7. If you are under 18",
      body: [
        "You need your parent or guardian's agreement to take part, and we ask you to confirm this when you register.",
        "A parent or guardian may contact us at any time to see what we hold about their child, correct it, or ask us to delete it.",
      ],
    },
    {
      heading: "8. How long we keep it",
      body: [
        "We keep competition data for 24 months after the season ends, so that results can be verified and disputes resolved.",
        "After that, we keep only anonymous statistics — for example how difficult a question turned out to be — which cannot be linked back to you.",
      ],
    },
    {
      heading: "9. Your rights",
      body: ["You can, at any time:"],
      list: [
        "Ask what personal data we hold about you.",
        "Ask us to correct anything that is wrong.",
        "Withdraw your consent and ask us to delete your account.",
        "Ask us to stop contacting you.",
      ],
    },
    {
      heading: "10. Withdrawing",
      body: [
        "If you withdraw consent, we remove your account and your personal details. Anonymous statistics already used to calibrate question difficulty remain, because they no longer identify you and removing them would distort the results for everyone else.",
        "Withdrawing during the season means you leave the competition and give up any prize eligibility.",
      ],
    },
    {
      heading: "11. Security",
      body: [
        "Your contact details are stored separately from the data used to build leaderboards, so a leaderboard cannot expose them. Access is restricted to staff who need it.",
        "No system is perfectly secure. If a breach occurs that puts you at risk, we will tell you.",
      ],
    },
    {
      heading: "12. Contact",
      body: [
        "To exercise any of the rights above, or to raise a concern, email spmgames@edupass.my.",
      ],
    },
  ],
};
