import { footerSchema, newId, type Block, type StepFooter, type StepSize } from "./guide-schema";

// Starting points for new tour steps and announcements, shown in the template
// picker. `origin` is this app's public address, for the bundled illustrations.

export type TemplateKind = "modal" | "tooltip";

export type StepTemplate = {
  id: string;
  kind: TemplateKind;
  name: string;
  description: string;
  build: (origin: string) => {
    blocks: Block[];
    footer: StepFooter;
    size: StepSize;
    advanceOn?: "next" | "click";
    backdrop?: boolean;
  };
};

const footer = (p: Partial<StepFooter> = {}) => footerSchema.parse(p);
const id = newId;

const heading = (text: string, align: "left" | "center" = "left"): Block => ({ type: "heading", id: id(), text, align });
const text = (t: string, align: "left" | "center" = "left"): Block => ({ type: "text", id: id(), text: t, align });

export const stepTemplates: StepTemplate[] = [
  // ---------- Modals ----------
  {
    id: "modal-scratch",
    kind: "modal",
    name: "Create from scratch",
    description: "Image, title and text. Build it your way.",
    build: () => ({
      blocks: [
        { type: "image", id: id(), url: "", alt: "", height: 160, fit: "cover", edge: true, overlay: "" },
        heading(""),
        text(""),
      ],
      footer: footer(),
      size: "md",
    }),
  },
  {
    id: "modal-welcome",
    kind: "modal",
    name: "Welcome modal",
    description: "Friendly illustration and a centered welcome.",
    build: (origin) => ({
      blocks: [
        { type: "image", id: id(), url: `${origin}/templates/welcome.svg`, alt: "", height: 150, fit: "contain", edge: false, overlay: "" },
        heading("Welcome to our platform", "center"),
        text("Take a quick tour to see the features that will save you the most time.", "center"),
      ],
      footer: footer({ nextLabel: "Let's go" }),
      size: "md",
    }),
  },
  {
    id: "modal-hero",
    kind: "modal",
    name: "Hero modal",
    description: "Full-width image with a headline on top.",
    build: (origin) => ({
      blocks: [
        { type: "image", id: id(), url: `${origin}/templates/hero.svg`, alt: "", height: 200, fit: "cover", edge: true, overlay: "Hero text" },
        text("Get your stuff done with our amazing features. Make everything work smoothly in no time.", "center"),
        { type: "buttons", id: id(), align: "center", buttons: [{ id: id(), label: "Proceed", style: "primary", action: { type: "next" } }] },
      ],
      footer: footer({ show: false }),
      size: "md",
    }),
  },
  {
    id: "modal-video",
    kind: "modal",
    name: "Video modal",
    description: "A title and an embedded YouTube, Vimeo or MP4 video.",
    build: () => ({
      blocks: [heading("See it in action"), { type: "video", id: id(), url: "" }, text("A two-minute overview of the essentials.")],
      footer: footer(),
      size: "lg",
    }),
  },
  {
    id: "modal-feature",
    kind: "modal",
    name: "New feature",
    description: "Announce a feature with a link to learn more.",
    build: (origin) => ({
      blocks: [
        { type: "image", id: id(), url: `${origin}/templates/feature.svg`, alt: "", height: 170, fit: "cover", edge: true, overlay: "" },
        heading("Introducing a new feature"),
        text("Describe what it does and why it helps, in one or two sentences."),
        {
          type: "buttons",
          id: id(),
          align: "right",
          buttons: [
            { id: id(), label: "Learn more", style: "secondary", action: { type: "url", url: "", newTab: true } },
            { id: id(), label: "Got it", style: "primary", action: { type: "complete" } },
          ],
        },
      ],
      footer: footer({ show: false }),
      size: "md",
    }),
  },
  {
    id: "modal-finish",
    kind: "modal",
    name: "All set",
    description: "A celebratory last step.",
    build: (origin) => ({
      blocks: [
        { type: "image", id: id(), url: `${origin}/templates/celebrate.svg`, alt: "", height: 140, fit: "contain", edge: false, overlay: "" },
        heading("You're all set!", "center"),
        text("You know the essentials. Explore at your own pace.", "center"),
        { type: "buttons", id: id(), align: "center", buttons: [{ id: id(), label: "Finish", style: "primary", action: { type: "complete" } }] },
      ],
      footer: footer({ show: false }),
      size: "sm",
    }),
  },

  // ---------- Tooltips ----------
  {
    id: "tooltip-simple",
    kind: "tooltip",
    name: "Simple tooltip",
    description: "Title and text pointing at an element.",
    build: () => ({ blocks: [heading("Title"), text("Explain what this element does.")], footer: footer(), size: "md" }),
  },
  {
    id: "tooltip-image",
    kind: "tooltip",
    name: "Tooltip with image",
    description: "A picture on top for extra context.",
    build: (origin) => ({
      blocks: [
        { type: "image", id: id(), url: `${origin}/templates/feature.svg`, alt: "", height: 120, fit: "cover", edge: true, overlay: "" },
        heading("Title"),
        text("Explain what this element does."),
      ],
      footer: footer(),
      size: "md",
    }),
  },
  {
    id: "tooltip-action",
    kind: "tooltip",
    name: "Action tooltip",
    description: "Asks the user to click the element to continue.",
    build: () => ({
      blocks: [text("**Click here** to continue.")],
      footer: footer({ showBack: false }),
      size: "sm",
      advanceOn: "click",
    }),
  },
  {
    id: "tooltip-hint",
    kind: "tooltip",
    name: "Minimal hint",
    description: "One line, no dimming, no progress.",
    build: () => ({
      blocks: [text("A short hint about this element.")],
      footer: footer({ showBack: false, showProgress: false, nextLabel: "Got it", doneLabel: "Got it" }),
      size: "sm",
      backdrop: false,
    }),
  },
];
