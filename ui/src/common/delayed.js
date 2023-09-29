export default async function delayed(fn, delay) {
  await new Promise((resolve) => setTimeout(resolve, delay));
  return fn();
}
