import type { SearchRange, SearchSort, SearchStatus } from "@/lib/search";

export const STATUS_LABEL: Record<SearchStatus, string> = {
  all: "All",
  answered: "Answered",
  unanswered: "Unanswered",
};

export const RANGE_LABEL: Record<SearchRange, string> = {
  all: "Any time",
  week: "Past week",
  month: "Past month",
  year: "Past year",
};

export const SORT_LABEL: Record<SearchSort, string> = {
  relevance: "Relevance",
  newest: "Newest",
};
