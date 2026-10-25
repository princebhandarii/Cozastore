import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { watchAuthState } from "../firebase/config";
import { setFirebaseReady, syncProfile } from "../store/authSlice";
import { fetchCart } from "../store/cartSlice";
import { fetchWishlist } from "../store/wishlistSlice";

// Mounted once at the app root. Firebase persists the session in the
// browser itself, so on every page load we just need to ask it "who is
// signed in right now?" and then ask our own backend to hydrate the
// matching MongoDB profile (name, role, addresses, wishlist...).
export default function useAuthListener() {
  const dispatch = useDispatch();
  const profileId = useSelector((state) => state.auth.profile?._id);

  useEffect(() => {
    const unsubscribe = watchAuthState((firebaseUser) => {
      dispatch(setFirebaseReady(firebaseUser));
      if (firebaseUser) {
        dispatch(syncProfile());
      }
    });
    return unsubscribe;
  }, [dispatch]);

  // Once the MongoDB profile is loaded, hydrate the user's cart and wishlist.
  useEffect(() => {
    if (profileId) {
      dispatch(fetchCart());
      dispatch(fetchWishlist());
    }
  }, [profileId, dispatch]);
}
