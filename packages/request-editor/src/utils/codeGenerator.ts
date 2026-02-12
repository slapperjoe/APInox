export type CodeLanguage = 'curl' | 'node' | 'python' | 'csharp' | 'csharp-restsharp' | 'csharp-xunit';

export const generateCode = (request: any, language: CodeLanguage, environment?: any): string => {
    const url = request.endpoint || 'http://localhost';
    const headers = {
        'Content-Type': request.soapVersion === '1.2' ? 'application/soap+xml; charset=utf-8' : 'text/xml; charset=utf-8',
        'SOAPAction': request.soapAction || ''
    };

    // Simple variable substitution
    let body = request.request || '';
    if (environment) {
        Object.keys(environment).forEach(key => {
            const val = environment[key];
            body = body.replace(new RegExp(`{{${key}}}`, 'g'), val);
        });
    }

    // Extract operation name for C# method names
    const operationName = request.name || request.operationName || 'ExecuteRequest';
    const safeName = operationName.replace(/[^a-zA-Z0-9]/g, '');

    switch (language) {
        case 'curl':
            return generateCurl(url, headers, body);

        case 'node':
            return generateNode(url, headers, body);

        case 'python':
            return generatePython(url, headers, body);

        case 'csharp':
            return generateCSharpHttpClient(url, headers, body, safeName);

        case 'csharp-restsharp':
            return generateCSharpRestSharp(url, headers, body, safeName);

        case 'csharp-xunit':
            return generateCSharpXUnit(url, headers, body, safeName);

        default:
            return 'Unsupported language';
    }
};

function generateCurl(url: string, headers: any, body: string): string {
    return `curl --location '${url}' \\
--header 'Content-Type: ${headers['Content-Type']}' \\
--header 'SOAPAction: ${headers['SOAPAction']}' \\
--data '${body.replace(/'/g, "'\\''")}'`;
}

function generateNode(url: string, headers: any, body: string): string {
    return `const myHeaders = new Headers();
myHeaders.append("Content-Type", "${headers['Content-Type']}");
myHeaders.append("SOAPAction", "${headers['SOAPAction']}");

const raw = \`${body.replace(/`/g, '\\`')}\`;

const requestOptions = {
  method: "POST",
  headers: myHeaders,
  body: raw,
  redirect: "follow"
};

fetch("${url}", requestOptions)
  .then((response) => response.text())
  .then((result) => console.log(result))
  .catch((error) => console.error(error));`;
}

function generatePython(url: string, headers: any, body: string): string {
    return `import requests

url = "${url}"

payload = """${body}"""
headers = {
  'Content-Type': '${headers['Content-Type']}',
  'SOAPAction': '${headers['SOAPAction']}'
}

response = requests.request("POST", url, headers=headers, data=payload)

print(response.text)`;
}

function generateCSharpHttpClient(url: string, headers: any, body: string, methodName: string): string {
    const escapedBody = body.replace(/"/g, '""');
    const contentType = headers['Content-Type'].split(';')[0];
    
    return `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace YourNamespace
{
    public class ${methodName}Client
    {
        private readonly HttpClient _httpClient;

        public ${methodName}Client()
        {
            _httpClient = new HttpClient();
        }

        public async Task<string> ${methodName}Async()
        {
            var url = "${url}";
            
            var requestMessage = new HttpRequestMessage(HttpMethod.Post, url);
            requestMessage.Headers.Add("SOAPAction", "${headers['SOAPAction']}");
            
            var xmlContent = @"${escapedBody}";
            var content = new StringContent(xmlContent, Encoding.UTF8, "${contentType}");
            requestMessage.Content = content;

            try
            {
                var response = await _httpClient.SendAsync(requestMessage);
                response.EnsureSuccessStatusCode();
                
                var responseBody = await response.Content.ReadAsStringAsync();
                return responseBody;
            }
            catch (HttpRequestException ex)
            {
                throw new Exception($"SOAP request failed: {ex.Message}", ex);
            }
        }
    }
}`;
}

function generateCSharpRestSharp(url: string, headers: any, body: string, methodName: string): string {
    const escapedBody = body.replace(/"/g, '""');
    
    return `using System;
using System.Threading.Tasks;
using RestSharp;

namespace YourNamespace
{
    public class ${methodName}Client
    {
        private readonly RestClient _client;

        public ${methodName}Client()
        {
            var options = new RestClientOptions("${url}");
            _client = new RestClient(options);
        }

        public async Task<string> ${methodName}Async()
        {
            var request = new RestRequest()
                .AddHeader("Content-Type", "${headers['Content-Type']}")
                .AddHeader("SOAPAction", "${headers['SOAPAction']}")
                .AddStringBody(@"${escapedBody}", ContentType.Xml);

            try
            {
                var response = await _client.PostAsync(request);
                
                if (!response.IsSuccessful)
                {
                    throw new Exception($"SOAP request failed: {response.StatusCode} - {response.Content}");
                }
                
                return response.Content ?? string.Empty;
            }
            catch (Exception ex)
            {
                throw new Exception($"SOAP request failed: {ex.Message}", ex);
            }
        }
    }
}`;
}

function generateCSharpXUnit(url: string, headers: any, body: string, methodName: string): string {
    const escapedBody = body.replace(/"/g, '""');
    const contentType = headers['Content-Type'].split(';')[0];
    
    return `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Xunit;

namespace YourNamespace.Tests
{
    public class ${methodName}Tests
    {
        private readonly HttpClient _httpClient;

        public ${methodName}Tests()
        {
            _httpClient = new HttpClient();
        }

        [Fact]
        public async Task ${methodName}_Should_Return_Success()
        {
            // Arrange
            var url = "${url}";
            var requestMessage = new HttpRequestMessage(HttpMethod.Post, url);
            requestMessage.Headers.Add("SOAPAction", "${headers['SOAPAction']}");
            
            var xmlContent = @"${escapedBody}";
            var content = new StringContent(xmlContent, Encoding.UTF8, "${contentType}");
            requestMessage.Content = content;

            // Act
            var response = await _httpClient.SendAsync(requestMessage);

            // Assert
            response.EnsureSuccessStatusCode();
            var responseBody = await response.Content.ReadAsStringAsync();
            
            Assert.NotNull(responseBody);
            Assert.NotEmpty(responseBody);
            // TODO: Add more specific assertions based on expected response
        }

        [Fact]
        public async Task ${methodName}_Should_Handle_Errors()
        {
            // Arrange
            var url = "http://invalid-endpoint.local";
            var requestMessage = new HttpRequestMessage(HttpMethod.Post, url);
            requestMessage.Headers.Add("SOAPAction", "${headers['SOAPAction']}");
            
            var xmlContent = @"${escapedBody}";
            var content = new StringContent(xmlContent, Encoding.UTF8, "${contentType}");
            requestMessage.Content = content;

            // Act & Assert
            await Assert.ThrowsAsync<HttpRequestException>(async () =>
            {
                await _httpClient.SendAsync(requestMessage);
            });
        }
    }
}`;
}
