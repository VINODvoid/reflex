interface HealthInterface {
  status: string;
}

export async function getHealth(): Promise<HealthInterface> {
  const data = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`);
  const response = await data.json();
  return response;
}

export async function registerUser(
  expoPushToken: string,
): Promise<{ id: string }> {
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expoPushToken }),
  });
  if (!res.ok) throw new Error("failed to register user");
  return res.json();
}
