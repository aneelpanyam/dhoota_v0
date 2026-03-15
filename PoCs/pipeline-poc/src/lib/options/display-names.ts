/**
 * User-friendly display name overrides for options.
 * Use when the DB option name (e.g. "Create") is unclear in context.
 * The conversation should read as if the user said the display name.
 */
export const OPTION_DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "activity.create": "Add Activity",
  "activity.create_bulk": "Add Activities",
  "profile.set_avatar": "Set Avatar",
  "info_card.create": "Create Info Card",
  // Public/citizen options – conversational, question-like
  "public.activities": "What have you been up to?",
  "public.recent_activities": "What have you been up to lately?",
  "public.stats": "How busy have you been?",
  "public.announcements": "Any announcements that I should know?",
  "public.info_cards": "Do you have any useful information for me?",
  "public.about": "Can I know more about you?",
};

/**
 * Conversational, instructional headers for option flows.
 * Explains what the user is expected to do, making the UI feel like a dialogue.
 */
export const OPTION_HEADER_GUIDANCE: Record<string, string> = {
  "activity.create": "Provide details of your activity",
  "activity.create_bulk": "Add multiple activities at once",
  "activity.edit": "Edit the activity details",
  "activity.add_note": "Add a note to this activity",
  "activity.add_media": "Attach photos or videos to this activity",
  "profile.set_avatar": "Upload your profile photo",
  "profile.edit": "Update your profile",
  "info_card.create": "Create an info card for your site",
  "info_card.edit": "Edit the info card",
  "announcement.create": "Create an announcement",
  "announcement.edit": "Edit the announcement",
  "tag.create": "Create a new tag",
  "program.create": "Create a new program",
  "program.edit": "Edit the program",
  "program.add_activity": "Add an activity to this program",
  "suggestion_box.create": "Create a suggestion box",
  "citizen.group.create": "Create a citizen group",
};

export function getOptionDisplayName(optionId: string, fallbackName: string): string {
  return OPTION_DISPLAY_NAME_OVERRIDES[optionId] ?? fallbackName;
}

export function getOptionHeaderGuidance(optionId: string, fallbackDisplayName: string): string {
  return OPTION_HEADER_GUIDANCE[optionId] ?? `Complete ${fallbackDisplayName}`;
}
