import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** Java 21 - cliente independente de bibliotecas. API implementada pelo host. */
public class OrquestraClient {
    public static String listDocuments(String baseUrl, String token) throws Exception {
        if (!baseUrl.startsWith("https://")) throw new IllegalArgumentException("Exija HTTPS");
        try (HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()) {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl.replaceAll("/+$", "") + "/api/documents"))
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + token)
                .header("Accept", "application/json")
                .GET().build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2)
                throw new IllegalStateException("HTTP " + response.statusCode());
            return response.body();
        }
    }
    public static void main(String[] args) throws Exception {
        String url = System.getenv("ORQ_API_URL"), token = System.getenv("ORQ_API_TOKEN");
        if (url == null || token == null) throw new IllegalArgumentException("Configure ORQ_API_URL/ORQ_API_TOKEN");
        System.out.println(listDocuments(url, token));
    }
}
