// Indian cities grouped by state → drives the checkout city autocomplete and
// lets us autofill the state when a city is picked. Not exhaustive, but covers
// the vast majority of orders; unlisted cities can still be typed (base charge).
const BY_STATE = {
  'Delhi': ['Delhi', 'New Delhi'],
  'Uttar Pradesh': ['Noida', 'Greater Noida', 'Ghaziabad', 'Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Prayagraj', 'Allahabad', 'Meerut', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Firozabad', 'Jhansi', 'Muzaffarnagar', 'Mathura', 'Rampur', 'Ayodhya', 'Etawah', 'Mirzapur', 'Bulandshahr', 'Sitapur', 'Unnao', 'Jaunpur', 'Shahjahanpur'],
  'Haryana': ['Faridabad', 'Gurugram', 'Gurgaon', 'Ambala', 'Panipat', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Jind', 'Kaithal', 'Rewari', 'Palwal'],
  'Maharashtra': ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Pimpri-Chinchwad', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur', 'Amravati', 'Nanded', 'Sangli', 'Jalgaon', 'Akola', 'Latur', 'Ahmednagar'],
  'Karnataka': ['Bengaluru', 'Bangalore', 'Mysuru', 'Mysore', 'Hubli', 'Dharwad', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Davanagere', 'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Udupi'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Nagercoil', 'Hosur', 'Karur'],
  'Telangana': ['Hyderabad', 'Secunderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Kadapa', 'Kakinada', 'Tirupati', 'Anantapur', 'Eluru', 'Ongole'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Kharagpur', 'Haldia'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Nadiad', 'Morbi', 'Mehsana', 'Bharuch', 'Vapi', 'Navsari', 'Gandhidham'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Bhilwara', 'Alwar', 'Sikar', 'Pali', 'Sri Ganganagar', 'Bharatpur', 'Tonk', 'Beawar', 'Hanumangarh', 'Chittorgarh', 'Nagaur'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Katni', 'Singrauli', 'Burhanpur', 'Khandwa', 'Chhindwara', 'Vidisha'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Arrah', 'Begusarai', 'Katihar', 'Chapra', 'Munger', 'Bihar Sharif', 'Hajipur', 'Sasaram', 'Motihari'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Pathankot', 'Moga', 'Firozpur', 'Khanna', 'Barnala'],
  'Chandigarh': ['Chandigarh'],
  'Kerala': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha', 'Palakkad', 'Kottayam', 'Malappuram', 'Kasaragod', 'Pathanamthitta', 'Idukki'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Baripada'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Raigarh', 'Jagdalpur'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh', 'Giridih', 'Ramgarh'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Rishikesh', 'Nainital'],
  'Himachal Pradesh': ['Shimla', 'Solan', 'Mandi', 'Dharamshala', 'Kullu', 'Manali'],
  'Jammu and Kashmir': ['Jammu', 'Srinagar', 'Anantnag', 'Baramulla', 'Udhampur'],
  'Ladakh': ['Leh'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  'Manipur': ['Imphal'],
  'Tripura': ['Agartala'],
  'Mizoram': ['Aizawl'],
  'Meghalaya': ['Shillong'],
  'Nagaland': ['Kohima', 'Dimapur'],
  'Arunachal Pradesh': ['Itanagar'],
  'Sikkim': ['Gangtok'],
  'Puducherry': ['Puducherry'],
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Silvassa'],
  'Lakshadweep': ['Kavaratti'],
}

export const INDIAN_CITIES = [...new Set(Object.values(BY_STATE).flat())].sort((a, b) => a.localeCompare(b))

// State-first address entry: pick a state, then the city field autocompletes to
// just that state's cities.
export const INDIAN_STATES = Object.keys(BY_STATE).sort((a, b) => a.localeCompare(b))
export const CITIES_BY_STATE = Object.fromEntries(
  Object.entries(BY_STATE).map(([state, cities]) => [state, [...new Set(cities)].sort((a, b) => a.localeCompare(b))])
)

export const CITY_STATE = Object.fromEntries(
  Object.entries(BY_STATE).flatMap(([state, cities]) => cities.map((c) => [c.toLowerCase(), state]))
)
