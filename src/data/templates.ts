export interface InvoiceTemplate {
  name: string;
  description: string;
  recipients: Array<{ address: string; amount: string }>;
  token: string;
  deadlineDays: number;
}

export const templates: InvoiceTemplate[] = [
  {
    name: "Freelance Project",
    description: "Split payment between project lead and team members",
    recipients: [
      { address: "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJJVNSTQWCNHC56RWJF7W2ZN7", amount: "1000" },
      { address: "GBBD47UZQ5UZKRTZGNNX3E3O6ORQ4IJYU6VSA7CJWLVLULXSIKZZRYE", amount: "500" },
      { address: "GCZST3XVCDTUJ76ZAV2HA72KYQJD5JJWKXJ7YFVQXVJ5YFVQXVJ5YF", amount: "300" },
    ],
    token: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "",
    deadlineDays: 14,
  },
  {
    name: "Group Purchase",
    description: "Split cost equally among group members",
    recipients: [
      { address: "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJJVNSTQWCNHC56RWJF7W2ZN7", amount: "250" },
      { address: "GBBD47UZQ5UZKRTZGNNX3E3O6ORQ4IJYU6VSA7CJWLVLULXSIKZZRYE", amount: "250" },
      { address: "GCZST3XVCDTUJ76ZAV2HA72KYQJD5JJWKXJ7YFVQXVJ5YFVQXVJ5YF", amount: "250" },
      { address: "GDQQ7ZCVQFVJ5YFVQXVJ5YFVQXVJ5YFVQXVJ5YFVQXVJ5YFVQXVJ5Y", amount: "250" },
    ],
    token: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "",
    deadlineDays: 7,
  },
  {
    name: "Remittance",
    description: "Send funds to family members in different regions",
    recipients: [
      { address: "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJJVNSTQWCNHC56RWJF7W2ZN7", amount: "500" },
      { address: "GBBD47UZQ5UZKRTZGNNX3E3O6ORQ4IJYU6VSA7CJWLVLULXSIKZZRYE", amount: "500" },
    ],
    token: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "",
    deadlineDays: 30,
  },
  {
    name: "Vendor Payment",
    description: "Pay multiple vendors for supplies",
    recipients: [
      { address: "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJJVNSTQWCNHC56RWJF7W2ZN7", amount: "2000" },
      { address: "GBBD47UZQ5UZKRTZGNNX3E3O6ORQ4IJYU6VSA7CJWLVLULXSIKZZRYE", amount: "1500" },
    ],
    token: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "",
    deadlineDays: 21,
  },
  {
    name: "Event Expenses",
    description: "Split event costs among organizers",
    recipients: [
      { address: "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJJVNSTQWCNHC56RWJF7W2ZN7", amount: "800" },
      { address: "GBBD47UZQ5UZKRTZGNNX3E3O6ORQ4IJYU6VSA7CJWLVLULXSIKZZRYE", amount: "600" },
      { address: "GCZST3XVCDTUJ76ZAV2HA72KYQJD5JJWKXJ7YFVQXVJ5YFVQXVJ5YF", amount: "400" },
    ],
    token: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "",
    deadlineDays: 10,
  },
  {
    name: "Contractor Invoice",
    description: "Pay contractors for services rendered",
    recipients: [
      { address: "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJJVNSTQWCNHC56RWJF7W2ZN7", amount: "3000" },
    ],
    token: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "",
    deadlineDays: 15,
  },
];
