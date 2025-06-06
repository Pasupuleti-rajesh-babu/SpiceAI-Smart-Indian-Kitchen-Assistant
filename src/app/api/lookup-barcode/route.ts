
import { type NextRequest, NextResponse } from 'next/server';

const UPCITEMDB_API_URL = "https://api.upcitemdb.com/prod/trial/lookup";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { upc } = body;

    if (!upc) {
      return NextResponse.json({ message: 'UPC code is required' }, { status: 400 });
    }

    const apiResponse = await fetch(UPCITEMDB_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No API key needed for the trial version
      },
      body: JSON.stringify({ upc }),
    });

    if (!apiResponse.ok) {
      // Try to parse error from UPCItemDB if possible
      let errorData;
      try {
        errorData = await apiResponse.json();
      } catch (e) {
        // If parsing error response fails, use a generic message
        errorData = { message: `UPCItemDB API request failed with status: ${apiResponse.status}` };
      }
      console.error('UPCItemDB API Error:', errorData);
      return NextResponse.json(
        { message: errorData.message || `UPCItemDB API request failed with status: ${apiResponse.status}` },
        { status: apiResponse.status }
      );
    }

    const data = await apiResponse.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/lookup-barcode:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error processing barcode lookup' },
      { status: 500 }
    );
  }
}
