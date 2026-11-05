using System.Net.Http.Headers;

var url = Environment.GetEnvironmentVariable("ORQ_API_URL")
    ?? throw new InvalidOperationException("Configure ORQ_API_URL");
var token = Environment.GetEnvironmentVariable("ORQ_API_TOKEN")
    ?? throw new InvalidOperationException("Configure ORQ_API_TOKEN");
if (!url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("Em produção use HTTPS");
using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
var response = await http.GetAsync(url.TrimEnd('/') + "/api/documents");
response.EnsureSuccessStatusCode();
Console.WriteLine(await response.Content.ReadAsStringAsync());
// API HTTP: contrato de integração. O host deve implementá-la com ACL de tenant.
