using SmartLightingDigitalTwinApi;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactDashboardPolicy", policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

// 2. تسجيل خدمة MQTT في الخلفية
builder.Services.AddSingleton<MqttDigitalTwinWorker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<MqttDigitalTwinWorker>());

var app = builder.Build();

app.UseCors("ReactDashboardPolicy");

// 3. مسار SignalR Hub للبث اللحظي
app.MapHub<StreetLightHub>("/hubs/streetlight");

// 4. Endpoint لاستقبال أوامر التحكم من React وتوجيهها إلى Wokwi
app.MapPost("/api/poles/{poleId}/command", async (
    string poleId,
    PoleCommandRequest command,
    MqttDigitalTwinWorker mqttWorker) =>
{
    await mqttWorker.SendCommandAsync(poleId, command);
    return Results.Ok(new { message = $"Command sent to {poleId}" });
});

app.Run();