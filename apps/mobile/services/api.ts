interface HealthInterface {
  status: string;
}

export async function getHealth(): Promise<HealthInterface> {
  const data = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`);
  const response = await data.json();
  return response;
}
