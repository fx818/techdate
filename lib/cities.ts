// Comprehensive list of Indian cities for the city picker (onboarding + edit
// profile). Bundled locally — no external geo API (free-tier friendly, offline).
//
// Covers metros + all state/UT capitals + major tier-2/3 cities. It is NOT every
// village in India (that would be ~600k entries and unusable); the city input is
// a free-text typeahead, so anyone whose town isn't listed can still type it.
//
// NOTE: keep the original spellings used since launch (Bangalore, Gurgaon, …).
// The People deck scopes matches by exact `city` string, so renaming to
// Bengaluru/Gurugram would split existing users from new ones.

export const INDIAN_CITIES: string[] = [
  'Agartala', 'Agra', 'Ahmedabad', 'Ahmednagar', 'Aizawl', 'Ajmer', 'Akola',
  'Aligarh', 'Allahabad', 'Alwar', 'Ambala', 'Amravati', 'Amritsar', 'Anand',
  'Anantapur', 'Asansol', 'Aurangabad',
  'Bangalore', 'Bardhaman', 'Bareilly', 'Belgaum', 'Bellary', 'Berhampur',
  'Bhagalpur', 'Bharatpur', 'Bharuch', 'Bhavnagar', 'Bhilai', 'Bhilwara',
  'Bhiwandi', 'Bhopal', 'Bhubaneswar', 'Bidar', 'Bijapur', 'Bikaner',
  'Bilaspur', 'Bokaro', 'Burhanpur',
  'Chandigarh', 'Chennai', 'Chittoor', 'Coimbatore', 'Cuttack',
  'Darbhanga', 'Davanagere', 'Dehradun', 'Delhi', 'Deoghar', 'Dhanbad',
  'Dharwad', 'Dibrugarh', 'Dindigul', 'Durgapur',
  'Eluru', 'Erode',
  'Faridabad', 'Firozabad',
  'Gandhinagar', 'Gangtok', 'Gaya', 'Ghaziabad', 'Gorakhpur', 'Greater Noida',
  'Gulbarga', 'Guntur', 'Gurgaon', 'Guwahati', 'Gwalior',
  'Haldwani', 'Hapur', 'Haridwar', 'Hisar', 'Hospet', 'Howrah', 'Hubli',
  'Hyderabad',
  'Imphal', 'Indore', 'Itanagar',
  'Jabalpur', 'Jaipur', 'Jalandhar', 'Jalgaon', 'Jammu', 'Jamnagar',
  'Jamshedpur', 'Jhansi', 'Jodhpur', 'Jorhat', 'Junagadh',
  'Kakinada', 'Kalyan', 'Kanpur', 'Karimnagar', 'Karnal', 'Kochi', 'Kohima',
  'Kolhapur', 'Kolkata', 'Kollam', 'Korba', 'Kota', 'Kottayam', 'Kozhikode',
  'Kurnool',
  'Latur', 'Lucknow', 'Ludhiana',
  'Madurai', 'Mangalore', 'Mathura', 'Meerut', 'Mehsana', 'Moradabad',
  'Mumbai', 'Muzaffarnagar', 'Muzaffarpur', 'Mysore',
  'Nagercoil', 'Nagpur', 'Nanded', 'Nashik', 'Nellore', 'Noida',
  'Palakkad', 'Panaji', 'Panipat', 'Pathankot', 'Patiala', 'Patna',
  'Puducherry', 'Pune', 'Purnia',
  'Raipur', 'Rajahmundry', 'Rajkot', 'Ranchi', 'Ratlam', 'Rewa', 'Rohtak',
  'Roorkee', 'Rourkela',
  'Sagar', 'Saharanpur', 'Salem', 'Sambalpur', 'Sangli', 'Satara',
  'Secunderabad', 'Shillong', 'Shimla', 'Sikar', 'Siliguri', 'Solapur',
  'Sonipat', 'Srinagar', 'Surat',
  'Thane', 'Thanjavur', 'Thiruvananthapuram', 'Thrissur', 'Tiruchirappalli',
  'Tirunelveli', 'Tirupati', 'Tirupur', 'Tumkur',
  'Udaipur', 'Udupi', 'Ujjain', 'Unnao',
  'Vadodara', 'Varanasi', 'Vasai-Virar', 'Vellore', 'Vijayawada',
  'Visakhapatnam', 'Vizianagaram',
  'Warangal',
  'Yamunanagar',
]
