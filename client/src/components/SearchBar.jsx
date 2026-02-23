import { useState } from 'react';

const SUGGESTIONS = {
  categories: [
    'Restaurants', 'Coffee Shops', 'Barbershops', 'Hair Salons',
    'Dentists', 'HVAC', 'Plumbers', 'Electricians', 'Auto Repair',
    'Gyms', 'Yoga Studios', 'Pet Groomers', 'Florists', 'Bakeries',
    'Law Firms', 'Real Estate Agents', 'Chiropractors', 'Veterinarians',
  ],
  locations: [
    'Atlanta, GA', 'East Atlanta Village, GA', 'Decatur, GA',
    'Midtown Atlanta, GA', 'Buckhead, GA', 'Sandy Springs, GA',
  ],
};

export default function SearchBar({ onSearch, loading }) {
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (category.trim() && location.trim()) {
      onSearch(category.trim(), location.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Business Category
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. restaurants, dentists, HVAC..."
            list="category-suggestions"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            disabled={loading}
          />
          <datalist id="category-suggestions">
            {SUGGESTIONS.categories.map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="flex-1 relative">
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Atlanta, GA or 30312"
            list="location-suggestions"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            disabled={loading}
          />
          <datalist id="location-suggestions">
            {SUGGESTIONS.locations.map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading || !category.trim() || !location.trim()}
            className="w-full sm:w-auto px-8 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-gray-950 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Scan
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
