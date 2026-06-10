const AGENT_NAMES = [
  "Rohan Mehta",
  "Neha Kulkarni",
  "Samar Desai",
  "Isha Menon",
  "Karan Shah",
  "Mira Joshi",
  "Arjun Nair",
  "Priya Sethi",
  "Dev Malhotra",
  "Anika Rao",
  "Kabir Bhatia",
  "Tara Iyer",
  "Nikhil Patil",
  "Rhea Kapoor",
  "Vivaan Sharma",
  "Meera Chawla",
];

export function demoAgentName(id: string) {
  const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AGENT_NAMES[seed % AGENT_NAMES.length];
}
