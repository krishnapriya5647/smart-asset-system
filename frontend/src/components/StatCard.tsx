import { Card, CardContent, Typography } from "@mui/material";

export default function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Typography sx={{ color: "text.secondary" }}>{label}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}
