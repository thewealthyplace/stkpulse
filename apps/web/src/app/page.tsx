import { redirect } from "next/navigation";

// Root "/" redirects to the portfolio page
export default function RootPage() {
  redirect("/portfolio");
}
