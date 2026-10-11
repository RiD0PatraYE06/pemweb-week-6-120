(function () {
  const originalFetch = window.fetch;
  let mode = "normal"; // "normal", "offline", atau "lambat"

  // Data awal tiruan dari server
  let mockTugas = [
    { id: 1, judul: "Lab 10 event delegation", matkul: "Pemrograman Web", deadline: "2026-10-08", selesai: false },
    { id: 2, judul: "Ringkasan materi async/await", matkul: "Pemrograman Web", deadline: "2026-10-10", selesai: false }
  ];

  const mockMatkul = ["Pemrograman Web", "Basis Data", "Algoritma", "Jaringan Komputer"];

  // Pengujian mode server (poin 06)
  window.__API = {
    setMode: function (newMode) {
      mode = newMode;
      console.log(`[Mock API] Mode diubah ke: ${mode}`);
    }
  };

  // Intercept fetch API
  window.fetch = async function (url, options = {}) {
    const method = (options.method || "GET").toUpperCase();

    // Mode Offline
    if (mode === "offline") {
      throw new TypeError("Gagal terhubung ke jaringan (Offline Mode)");
    }

    // Mode Lambat (Delay 2 Detik)
    if (mode === "lambat") {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // GET /api/matkul
    if (url === "/api/matkul" && method === "GET") {
      return new Response(JSON.stringify(mockMatkul), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // GET /api/tugas
    if (url === "/api/tugas" && method === "GET") {
      return new Response(JSON.stringify(mockTugas), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // POST /api/tugas
    if (url === "/api/tugas" && method === "POST") {
      const body = JSON.parse(options.body || "{}");
      if (!body.judul || body.judul.trim().length < 3) {
        return new Response(JSON.stringify({ message: "Judul tugas minimal harus 3 karakter (Server 400)." }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const newTugas = {
        id: Date.now(),
        judul: body.judul.trim(),
        matkul: body.matkul || "Pemrograman Web",
        deadline: body.deadline || new Date().toISOString().split("T")[0],
        selesai: false
      };
      mockTugas.push(newTugas);
      return new Response(JSON.stringify(newTugas), { status: 201, headers: { "Content-Type": "application/json" } });
    }

    // PATCH /api/tugas/:id
    if (url.startsWith("/api/tugas/") && method === "PATCH") {
      const id = Number(url.split("/").pop());
      const body = JSON.parse(options.body || "{}");
      const index = mockTugas.findIndex(t => t.id === id);
      if (index !== -1) {
        mockTugas[index] = { ...mockTugas[index], ...body };
        return new Response(JSON.stringify(mockTugas[index]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ message: "Tugas tidak ditemukan" }), { status: 404 });
    }

    // DELETE /api/tugas/:id
    if (url.startsWith("/api/tugas/") && method === "DELETE") {
      const id = Number(url.split("/").pop());
      mockTugas = mockTugas.filter(t => t.id !== id);
      return new Response(null, { status: 204 });
    }

    return originalFetch(url, options);
  };
})();