import { useState, useCallback, useRef } from 'react';
import { searchBusinesses, streamAudits } from '../utils/api';

export function useSearch() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState(null);
  const [searchInfo, setSearchInfo] = useState(null);
  const abortRef = useRef(null);

  const search = useCallback(async (category, location) => {
    // Cancel any ongoing audit
    if (abortRef.current) {
      abortRef.current.abort();
    }

    setLoading(true);
    setAuditing(false);
    setError(null);
    setBusinesses([]);
    setProgress({ completed: 0, total: 0 });

    try {
      const data = await searchBusinesses(category, location);
      const businessList = data.businesses.map(b => ({
        ...b,
        audit: null,
      }));

      setBusinesses(businessList);
      setSearchInfo({
        category,
        location,
        count: businessList.length,
        source: data.source,
      });
      setLoading(false);

      // Start auditing
      if (businessList.length > 0) {
        setAuditing(true);
        setProgress({ completed: 0, total: businessList.length });

        abortRef.current = streamAudits(
          businessList,
          (result) => {
            setBusinesses(prev =>
              prev.map(b =>
                b.placeId === result.placeId
                  ? { ...b, audit: result }
                  : b
              )
            );
          },
          (prog) => {
            setProgress(prog);
          },
          () => {
            setAuditing(false);
          }
        );
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  const cancelAudit = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setAuditing(false);
    }
  }, []);

  return {
    businesses,
    loading,
    auditing,
    progress,
    error,
    searchInfo,
    search,
    cancelAudit,
  };
}
