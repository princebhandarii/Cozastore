import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

// requireAdmin=true also gates on the ROLE that MongoDB returned for this
// user - a role the frontend never gets to invent or override itself.
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const location = useLocation();
  const { firebaseReady, isAuthenticated, profile, status } = useSelector((state) => state.auth);

  // Show the spinner only while we genuinely don't know who the user is yet:
  // Firebase hasn't answered, or it has but the MongoDB profile hasn't loaded.
  // IMPORTANT: once a profile exists we must NOT go back to the spinner when a
  // background profile refresh runs (status === "loading") - that would unmount
  // the page, and pages that refresh the profile on mount (e.g. Checkout)
  // would then remount and refresh again, forever.
  const waitingForProfile = isAuthenticated && !profile && status !== "failed";
  if (!firebaseReady || waitingForProfile) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-300 border-t-ink-950" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && profile?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
