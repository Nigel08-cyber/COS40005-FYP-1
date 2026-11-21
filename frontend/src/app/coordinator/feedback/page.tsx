import type { Metadata } from "next";
import { CoordinatorFeedbackView } from "@/components/coordinator/views";

export const metadata: Metadata = { title: "Feedback · Tandem" };

// The staff layout only shows the page once the login is confirmed in the browser, so there is nothing to validate for instant navigation.
export const instant = false;

export default function FeedbackPage() {
  return <CoordinatorFeedbackView />;
}
