const IMAGE_ID_PATTERN = /^[0-9a-f]{16}$/;

interface Context {
  request: Request;
  params: Record<string, string>;
}

export const onRequestGet = async (context: Context): Promise<Response> => {
  const id = context.params.id || '';
  if (!IMAGE_ID_PATTERN.test(id)) {
    return new Response('Invalid image ID', { status: 400 });
  }
  const baseUrl = new URL(context.request.url).origin;
  return Response.redirect(`${baseUrl}/cdn/${id}`, 301);
};
